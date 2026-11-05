package com.museosmart.service;

import com.museosmart.dto.monitoreo.HistoricoResponse;
import com.museosmart.dto.monitoreo.LecturaResponse;
import com.museosmart.dto.monitoreo.ResumenMonitoreoResponse;
import com.museosmart.dto.monitoreo.SaludOutboxResponse;
import com.museosmart.dto.monitoreo.SensorMonitoreoResponse;
import com.museosmart.entity.Exhibicion;
import com.museosmart.entity.Sensor;
import com.museosmart.exception.ReglaNegocioException;
import com.museosmart.iot.influx.InfluxLector;
import com.museosmart.repository.AgregadosOutboxView;
import com.museosmart.repository.ConteoEstadoView;
import com.museosmart.repository.ExhibicionRepository;
import com.museosmart.repository.MonitoreoRepository;
import com.museosmart.repository.PromedioMetricaView;
import com.museosmart.repository.UltimaLecturaView;
import com.museosmart.repository.UltimaPresenciaView;
import com.museosmart.repository.redis.EstadoSensorRedis;
import com.museosmart.repository.redis.EstadoSensorRedisRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Consultas de solo lectura del módulo de Monitoreo IoT.
 *
 * <p>Fuente: {@code sensor} y {@code medicion_pendiente} (PostgreSQL). No
 * modifica el outbox ni depende de InfluxDB en esta fase.</p>
 *
 * <h2>Criterios</h2>
 * <ul>
 *   <li><b>Última lectura</b>: la de mayor {@code medido_en} por (sensor,
 *       métrica); se desempata por {@code id} descendente.</li>
 *   <li><b>Promedios</b>: solo métricas ambientales (TEMPERATURA/HUMEDAD/LUZ)
 *       dentro de una ventana reciente configurable (por defecto 24 h). Todas
 *       las filas persistidas ya superaron la validación de ingesta, así que el
 *       estado del outbox no se usa como filtro de validez, solo de
 *       trazabilidad.</li>
 *   <li><b>Sensor sin lecturas vs. desconectado</b>: un sensor sin filas en el
 *       outbox se marca {@code tieneLecturas=false}; NO se infiere
 *       "desconectado". El campo {@code estado} refleja el valor de la base de
 *       datos (ACTIVO/INACTIVO/MANTENIMIENTO), no conectividad en vivo.</li>
 * </ul>
 */
@Service
@Transactional(readOnly = true)
public class MonitoreoService {

    /** Ventana por defecto para los promedios (24 horas). */
    private static final long VENTANA_PROMEDIOS_HORAS = 24;

    /** Rango máximo permitido para el histórico (7 días) para acotar la consulta. */
    private static final long HISTORICO_MAX_HORAS = 24 * 7;

    /** Métricas con histórico disponible (no se consulta PRESENCIA aquí). */
    private static final Set<String> METRICAS_HISTORICO = Set.of("TEMPERATURA", "HUMEDAD", "LUZ");

    /** Formato de sensor aceptado como filtro opcional (código estable). */
    private static final Pattern PATRON_SENSOR = Pattern.compile("^[A-Za-z0-9_-]{1,80}$");

    private final MonitoreoRepository monitoreoRepository;
    private final InfluxLector influxLector;
    private final EstadoSensorRedisRepository estadoSensorRedis;
    private final ExhibicionRepository exhibicionRepository;

    public MonitoreoService(MonitoreoRepository monitoreoRepository, InfluxLector influxLector,
                            EstadoSensorRedisRepository estadoSensorRedis,
                            ExhibicionRepository exhibicionRepository) {
        this.monitoreoRepository = monitoreoRepository;
        this.influxLector = influxLector;
        this.estadoSensorRedis = estadoSensorRedis;
        this.exhibicionRepository = exhibicionRepository;
    }

    /** Lista de sensores con ubicación y últimas lecturas por métrica. */
    public List<SensorMonitoreoResponse> listarSensores() {
        List<Sensor> sensores = monitoreoRepository.listarSensoresConUbicacion();
        Map<Long, List<UltimaLecturaView>> porSensor = lecturasDesdeRedis()
                .map(MonitoreoService::agruparEstadosRedis)
                .orElseGet(this::agruparLecturas);

        List<SensorMonitoreoResponse> respuesta = new ArrayList<>(sensores.size());
        for (Sensor s : sensores) {
            List<UltimaLecturaView> lecturas = porSensor.getOrDefault(s.getId(), List.of());
            OffsetDateTime ultima = lecturas.stream()
                    .map(UltimaLecturaView::getMedidoEn)
                    .filter(java.util.Objects::nonNull)
                    .max(Comparator.naturalOrder())
                    .map(i -> i.atOffset(ZoneOffset.UTC))
                    .orElse(null);
            respuesta.add(new SensorMonitoreoResponse(
                    s.getId(),
                    s.getCodigo(),
                    s.getTipo(),
                    s.getCategoria(),
                    s.getEstado(),
                    s.getSala() != null ? s.getSala().getId() : null,
                    s.getSala() != null ? s.getSala().getNombre() : null,
                    s.getExhibicion() != null ? s.getExhibicion().getId() : null,
                    s.getExhibicion() != null ? s.getExhibicion().getTitulo() : null,
                    !lecturas.isEmpty(),
                    ultima,
                    lecturas.stream().map(MonitoreoService::aDto).toList()));
        }
        return respuesta;
    }

    /** Lecturas recientes (última por sensor y métrica). */
    public List<LecturaResponse> lecturasRecientes() {
        return lecturasDesdeRedis()
                .map(estados -> estados.stream()
                        .sorted(Comparator.comparing(EstadoSensorRedis::sensorId,
                                Comparator.nullsLast(Comparator.naturalOrder())))
                        .flatMap(e -> aLecturas(e).stream())
                        .toList())
                .filter(lista -> !lista.isEmpty())
                .orElseGet(() -> monitoreoRepository.ultimasLecturasPorSensor().stream()
                        .map(MonitoreoService::aDto)
                        .toList());
    }

    /** Resumen agregado con datos reales. */
    public ResumenMonitoreoResponse resumen() {
        List<Sensor> sensores = monitoreoRepository.listarSensoresConUbicacion();
        Map<Long, List<UltimaLecturaView>> porSensor = lecturasDesdeRedis()
                .map(MonitoreoService::agruparEstadosRedis)
                .orElseGet(this::agruparLecturas);

        int total = sensores.size();
        int activos = (int) sensores.stream()
                .filter(s -> "ACTIVO".equals(s.getEstado()))
                .count();
        int conLecturas = (int) sensores.stream()
                .filter(s -> !porSensor.getOrDefault(s.getId(), List.of()).isEmpty())
                .count();

        OffsetDateTime desde = OffsetDateTime.now().minus(VENTANA_PROMEDIOS_HORAS, ChronoUnit.HOURS);
        List<PromedioMetricaView> promedios = monitoreoRepository.promediosAmbientalesDesde(desde);
        List<ResumenMonitoreoResponse.PromedioResponse> promediosDto = promedios.stream()
                .map(p -> new ResumenMonitoreoResponse.PromedioResponse(
                        p.getMetrica(),
                        redondear(p.getPromedio()),
                        p.getUnidad(),
                        p.getTotal()))
                .toList();

        List<UltimaPresenciaView> presencias = presenciaActual(porSensor);
        long conPresencia = presencias.stream()
                .filter(p -> p.getValor() != null && p.getValor().signum() > 0)
                .count();
        ResumenMonitoreoResponse.PresenciaResumen presencia =
                new ResumenMonitoreoResponse.PresenciaResumen(conPresencia, presencias.size());

        return new ResumenMonitoreoResponse(
                total,
                activos,
                conLecturas,
                total - conLecturas,
                promediosDto,
                presencia);
    }

    /**
     * Estado del outbox: contadores reales por estado y agregados de
     * reintentos/errores. Solo lectura; no modifica el drenado ni los registros.
     * No se calcula un "estado de salud" global (no hay regla fiable).
     */
    public SaludOutboxResponse saludOutbox() {
        Map<String, Long> porEstado = new java.util.LinkedHashMap<>();
        long total = 0;
        for (ConteoEstadoView c : monitoreoRepository.contarPorEstado()) {
            porEstado.put(c.getEstado(), c.getTotal());
            total += c.getTotal();
        }
        AgregadosOutboxView agg = monitoreoRepository.agregadosOutbox();
        return new SaludOutboxResponse(
                total,
                porEstado,
                porEstado.getOrDefault("PENDIENTE", 0L),
                porEstado.getOrDefault("ENVIADO", 0L),
                porEstado.getOrDefault("ERROR", 0L),
                agg != null ? agg.getIntentosTotales() : 0L,
                agg != null ? agg.getMaxIntentos() : 0L,
                agg != null ? agg.getConReintentoProgramado() : 0L);
    }

    /**
     * Serie histórica de una métrica ambiental desde InfluxDB, opcionalmente
     * filtrada por sensor.
     *
     * @param metrica métrica (TEMPERATURA/HUMEDAD/LUZ); se normaliza a mayúsculas.
     * @param desde   inicio del rango (obligatorio).
     * @param hasta   fin del rango (obligatorio, posterior a {@code desde}).
     * @param sensor  código de sensor opcional; si se omite, se devuelven todas
     *                las series.
     * @throws ReglaNegocioException si los parámetros no son válidos o InfluxDB
     *         no está configurado.
     */
    public HistoricoResponse historico(String metrica, OffsetDateTime desde, OffsetDateTime hasta,
                                       String sensor) {
        if (metrica == null || metrica.isBlank()) {
            throw new ReglaNegocioException("La métrica es obligatoria");
        }
        String metricaNormalizada = metrica.trim().toUpperCase();
        if (!METRICAS_HISTORICO.contains(metricaNormalizada)) {
            throw new ReglaNegocioException(
                    "Métrica inválida: " + metrica + ". Valores permitidos: " + METRICAS_HISTORICO);
        }
        if (desde == null || hasta == null) {
            throw new ReglaNegocioException("El rango temporal (desde y hasta) es obligatorio");
        }
        if (!hasta.isAfter(desde)) {
            throw new ReglaNegocioException("El rango temporal es inválido: 'hasta' debe ser posterior a 'desde'");
        }
        long horas = ChronoUnit.HOURS.between(desde, hasta);
        if (horas > HISTORICO_MAX_HORAS) {
            throw new ReglaNegocioException("El rango no puede superar " + HISTORICO_MAX_HORAS + " horas");
        }
        if (!influxLector.habilitado()) {
            throw new ReglaNegocioException("El histórico no está disponible: InfluxDB no está configurado");
        }

        String sensorFiltro = null;
        if (sensor != null && !sensor.isBlank()) {
            String candidato = sensor.trim();
            if (!PATRON_SENSOR.matcher(candidato).matches()) {
                throw new ReglaNegocioException("El código de sensor no es válido");
            }
            sensorFiltro = candidato;
        }

        String flux = construirFlux(metricaNormalizada, desde, hasta, sensorFiltro,
                intervaloMinutos(desde, hasta));
        Map<String, List<InfluxLector.Punto>> series = influxLector.consultarSeries(flux);

        // Mapeo codigo de sensor -> sensor (con su sala). Se obtiene de
        // PostgreSQL, que sigue siendo la fuente de verdad de la ubicacion. Asi
        // la grafica puede etiquetar cada serie con el NOMBRE DE LA SALA y
        // anadir sus limites ambientales, sin inventar datos si no existe.
        Map<String, Sensor> sensorPorCodigo = new HashMap<>();
        for (Sensor s : monitoreoRepository.listarSensoresConUbicacion()) {
            sensorPorCodigo.put(s.getCodigo(), s);
        }
        Map<Long, LimitesAmbientales> limitesPorSala = new HashMap<>();

        List<HistoricoResponse.SerieSensor> seriesDto = new ArrayList<>(series.size());
        for (Map.Entry<String, List<InfluxLector.Punto>> entrada : series.entrySet()) {
            List<HistoricoResponse.PuntoHistorico> puntos = entrada.getValue().stream()
                    .map(p -> new HistoricoResponse.PuntoHistorico(
                            p.tiempo().atOffset(ZoneOffset.UTC), p.valor(),
                            p.minimo(), p.maximo()))
                    .toList();
            seriesDto.add(crearSerie(entrada.getKey(), puntos, sensorPorCodigo,
                    limitesPorSala, metricaNormalizada));
        }
        // La vista por sala necesita SIEMPRE las salas, aunque InfluxDB no
        // tenga filas en el periodo (sistema apagado, rango reciente sin
        // datos). Se completan series VACIAS a partir de los sensores
        // ambientales de PostgreSQL, sin inventar valores: la grafica mostrara
        // "Sin datos recientes" y el sombreado de todo el periodo.
        Set<String> incluidas = new java.util.HashSet<>();
        for (HistoricoResponse.SerieSensor serie : seriesDto) {
            incluidas.add(serie.sensor());
        }
        for (Sensor s : sensorPorCodigo.values()) {
            if (!"AMBIENTAL".equals(s.getCategoria()) || s.getCodigo() == null
                    || !incluidas.add(s.getCodigo())) {
                continue;
            }
            seriesDto.add(crearSerie(s.getCodigo(), List.of(), sensorPorCodigo,
                    limitesPorSala, metricaNormalizada));
        }
        seriesDto.sort(Comparator.comparing(HistoricoResponse.SerieSensor::sensor));

        return new HistoricoResponse(metricaNormalizada, desde, hasta,
                intervaloMinutos(desde, hasta), seriesDto);
    }

    /** Construye una serie enriquecida con su sala y limites (o vacia). */
    private HistoricoResponse.SerieSensor crearSerie(
            String codigo, List<HistoricoResponse.PuntoHistorico> puntos,
            Map<String, Sensor> sensorPorCodigo, Map<Long, LimitesAmbientales> limitesPorSala,
            String metrica) {
        Sensor sensorSerie = sensorPorCodigo.get(codigo);
        Long salaId = sensorSerie != null && sensorSerie.getSala() != null
                ? sensorSerie.getSala().getId() : null;
        Integer salaOrden = sensorSerie != null && sensorSerie.getSala() != null
                && sensorSerie.getSala().getOrden() != null
                ? sensorSerie.getSala().getOrden().intValue() : null;
        String salaNombre = sensorSerie != null && sensorSerie.getSala() != null
                ? sensorSerie.getSala().getNombre() : null;
        LimitesAmbientales limites = salaId != null
                ? limitesPorSala.computeIfAbsent(salaId, this::limitesDeSala)
                : LimitesAmbientales.VACIOS;
        return new HistoricoResponse.SerieSensor(
                codigo, salaId, salaOrden, salaNombre,
                limites.paraMinimo(metrica), limites.paraMaximo(metrica), puntos);
    }

    /**
     * Intervalo de agregación (minutos) según el rango solicitado:
     * 1 h → 1 min, 6 h → 5 min, 24 h → 15 min, 7 días → 1 h. Un rango menor o
     * igual a 1 h usa 1 min; uno mayor de 24 h usa 1 h.
     */
    static int intervaloMinutos(OffsetDateTime desde, OffsetDateTime hasta) {
        long horas = ChronoUnit.HOURS.between(desde, hasta);
        if (horas <= 1) {
            return 1;
        }
        if (horas <= 6) {
            return 5;
        }
        if (horas <= 24) {
            return 15;
        }
        return 60;
    }

    /**
     * Limites ambientales de una sala: el extremo mas permisivo entre sus
     * exhibiciones activas (mismo criterio que AlertaService). Asi la franja
     * sombreada coincide con lo que evalua el motor de alertas.
     */
    private LimitesAmbientales limitesDeSala(Long salaId) {
        BigDecimal tempMin = null;
        BigDecimal tempMax = null;
        BigDecimal humMin = null;
        BigDecimal humMax = null;
        BigDecimal luzMax = null;
        for (Exhibicion e : exhibicionRepository.findBySalaIdAndActiva(salaId, true)) {
            tempMin = minimo(tempMin, e.getTempMinC());
            tempMax = maximo(tempMax, e.getTempMaxC());
            humMin = minimo(humMin, e.getHumedadMinPct());
            humMax = maximo(humMax, e.getHumedadMaxPct());
            luzMax = maximo(luzMax, e.getLuzMaxLux());
        }
        return new LimitesAmbientales(tempMin, tempMax, humMin, humMax, luzMax);
    }

    private static BigDecimal minimo(BigDecimal actual, BigDecimal candidato) {
        if (candidato == null) {
            return actual;
        }
        return actual == null || candidato.compareTo(actual) < 0 ? candidato : actual;
    }

    private static BigDecimal maximo(BigDecimal actual, BigDecimal candidato) {
        if (candidato == null) {
            return actual;
        }
        return actual == null || candidato.compareTo(actual) > 0 ? candidato : actual;
    }

    /** Limites ambientales agregados de una sala (por metrica). */
    private record LimitesAmbientales(BigDecimal tempMin, BigDecimal tempMax,
                                      BigDecimal humMin, BigDecimal humMax,
                                      BigDecimal luzMax) {
        static final LimitesAmbientales VACIOS = new LimitesAmbientales(null, null, null, null, null);

        Double paraMinimo(String metrica) {
            return "TEMPERATURA".equals(metrica) ? aDouble(tempMin)
                    : "HUMEDAD".equals(metrica) ? aDouble(humMin) : null;
        }

        Double paraMaximo(String metrica) {
            return "TEMPERATURA".equals(metrica) ? aDouble(tempMax)
                    : "HUMEDAD".equals(metrica) ? aDouble(humMax)
                    : "LUZ".equals(metrica) ? aDouble(luzMax) : null;
        }

        private static Double aDouble(BigDecimal valor) {
            return valor != null ? valor.doubleValue() : null;
        }
    }

    /**
     * Construye la consulta Flux usando el esquema real de escritura:
     * measurement = métrica, tag sensor, field valor.
     *
     * <p>Los datos se agregan con {@code aggregateWindow} para reducir el
     * volumen (miles de muestras cada 5 s) y devolver el promedio de cada
     * ventana, junto con su mínimo y máximo. Se calculan las tres estadísticas
     * como tablas separadas y se combinan con {@code pivot}, que es más legible
     * y portable que un {@code reduce} personalizado.</p>
     */
    private String construirFlux(String metrica, OffsetDateTime desde, OffsetDateTime hasta,
                                 String sensor, int intervaloMinutos) {
        Instant ini = desde.toInstant();
        Instant fin = hasta.toInstant();
        String every = intervaloMinutos + "m";
        StringBuilder filtro = new StringBuilder();
        filtro.append("  |> filter(fn: (r) => r._measurement == \"").append(metrica).append("\")");
        filtro.append(" |> filter(fn: (r) => r._field == \"valor\")");
        if (sensor != null) {
            filtro.append(" |> filter(fn: (r) => r.sensor == \"").append(sensor).append("\")");
        }
        String base = "data = from(bucket: \"" + influxLector.getBucket() + "\")"
                + " |> range(start: " + ini + ", stop: " + fin + ")"
                + "\n" + filtro;
        return base
                + "\nmeans = data |> aggregateWindow(every: " + every
                + ", fn: mean, createEmpty: false) |> set(key: \"_stat\", value: \"mean\")"
                + "\nmins = data |> aggregateWindow(every: " + every
                + ", fn: min, createEmpty: false) |> set(key: \"_stat\", value: \"min\")"
                + "\nmaxs = data |> aggregateWindow(every: " + every
                + ", fn: max, createEmpty: false) |> set(key: \"_stat\", value: \"max\")"
                + "\nunion(tables: [means, mins, maxs])"
                + " |> pivot(rowKey: [\"_time\", \"sensor\"], columnKey: [\"_stat\"], valueColumn: \"_value\")"
                + " |> map(fn: (r) => ({r with _value: r.mean}))"
                + " |> keep(columns: [\"_time\", \"sensor\", \"_value\", \"min\", \"max\"])"
                + " |> sort(columns: [\"_time\"])";
    }

    private Map<Long, List<UltimaLecturaView>> agruparLecturas() {
        Map<Long, List<UltimaLecturaView>> porSensor = new HashMap<>();
        for (UltimaLecturaView l : monitoreoRepository.ultimasLecturasPorSensor()) {
            porSensor.computeIfAbsent(l.getSensorId(), k -> new ArrayList<>()).add(l);
        }
        return porSensor;
    }

    /**
     * Estado actual desde Redis. Vacio si Redis no responde o no hay ningun
     * sensor con datos vigentes; en ese caso se usa PostgreSQL.
     */
    private java.util.Optional<List<EstadoSensorRedis>> lecturasDesdeRedis() {
        return estadoSensorRedis.listarTodos()
                .filter(lista -> !lista.isEmpty());
    }

    /**
     * Convierte los estados de Redis a las lecturas del panel. Cada sensor
     * aporta su ultima temperatura/humedad/luz o su presencia. El estado del
     * outbox lo mantiene el drenador en el propio hash de Redis.
     */
    private static List<LecturaResponse> aLecturas(EstadoSensorRedis e) {
        List<LecturaResponse> lecturas = new ArrayList<>(4);
        OffsetDateTime actualizado = e.actualizadoEn();
        if (e.temperatura() != null) {
            lecturas.add(new LecturaResponse(e.sensorId(), "TEMPERATURA",
                    BigDecimal.valueOf(e.temperatura()), "C", actualizado, e.estadoTemperatura()));
        }
        if (e.humedad() != null) {
            lecturas.add(new LecturaResponse(e.sensorId(), "HUMEDAD",
                    BigDecimal.valueOf(e.humedad()), "%", actualizado, e.estadoHumedad()));
        }
        if (e.luminosidad() != null) {
            lecturas.add(new LecturaResponse(e.sensorId(), "LUZ",
                    BigDecimal.valueOf(e.luminosidad()), "lux", actualizado, e.estadoLuz()));
        }
        if (e.presencia() != null) {
            lecturas.add(new LecturaResponse(e.sensorId(), "PRESENCIA",
                    e.presencia() ? BigDecimal.ONE : BigDecimal.ZERO, null,
                    actualizado, e.estadoPresencia()));
        }
        return lecturas;
    }

    private static Map<Long, List<UltimaLecturaView>> agruparEstadosRedis(List<EstadoSensorRedis> estados) {
        Map<Long, List<UltimaLecturaView>> porSensor = new HashMap<>();
        for (EstadoSensorRedis e : estados) {
            if (e.sensorId() == null) {
                continue;
            }
            List<UltimaLecturaView> lecturas = new ArrayList<>();
            if (e.temperatura() != null) {
                lecturas.add(new LecturaCache(e.sensorId(), "TEMPERATURA",
                        BigDecimal.valueOf(e.temperatura()), "C", e.actualizadoEn(), e.estadoTemperatura()));
            }
            if (e.humedad() != null) {
                lecturas.add(new LecturaCache(e.sensorId(), "HUMEDAD",
                        BigDecimal.valueOf(e.humedad()), "%", e.actualizadoEn(), e.estadoHumedad()));
            }
            if (e.luminosidad() != null) {
                lecturas.add(new LecturaCache(e.sensorId(), "LUZ",
                        BigDecimal.valueOf(e.luminosidad()), "lux", e.actualizadoEn(), e.estadoLuz()));
            }
            if (e.presencia() != null) {
                lecturas.add(new LecturaCache(e.sensorId(), "PRESENCIA",
                        e.presencia() ? BigDecimal.ONE : BigDecimal.ZERO, null,
                        e.actualizadoEn(), e.estadoPresencia()));
            }
            porSensor.put(e.sensorId(), lecturas);
        }
        return porSensor;
    }

    /**
     * Presencia actual por sensor. Con Redis se deriva del estado vigente (los
     * sensores sin datos recientes no aparecen); sin Redis se consulta la base.
     */
    private List<UltimaPresenciaView> presenciaActual(Map<Long, List<UltimaLecturaView>> porSensor) {
        if (lecturasDesdeRedis().isPresent()) {
            List<UltimaPresenciaView> resultado = new ArrayList<>();
            for (Map.Entry<Long, List<UltimaLecturaView>> entrada : porSensor.entrySet()) {
                for (UltimaLecturaView l : entrada.getValue()) {
                    if ("PRESENCIA".equals(l.getMetrica())) {
                        resultado.add(new PresenciaCache(entrada.getKey(), l.getValor(), l.getMedidoEn()));
                    }
                }
            }
            return resultado;
        }
        return monitoreoRepository.ultimaPresenciaPorSensor();
    }

    /** Vista de lectura construida a partir del estado de Redis. */
    private record LecturaCache(Long sensorId, String metrica, BigDecimal valor,
                                String unidad, OffsetDateTime medidoEn, String estado)
            implements UltimaLecturaView {
        @Override
        public Long getSensorId() {
            return sensorId;
        }

        @Override
        public String getMetrica() {
            return metrica;
        }

        @Override
        public BigDecimal getValor() {
            return valor;
        }

        @Override
        public String getUnidad() {
            return unidad;
        }

        @Override
        public Instant getMedidoEn() {
            return medidoEn != null ? medidoEn.toInstant() : null;
        }

        @Override
        public String getEstado() {
            return estado;
        }
    }

    /** Vista de presencia construida a partir del estado de Redis. */
    private record PresenciaCache(Long sensorId, BigDecimal valor, Instant medidoEn)
            implements UltimaPresenciaView {
        @Override
        public Long getSensorId() {
            return sensorId;
        }

        @Override
        public BigDecimal getValor() {
            return valor;
        }

        @Override
        public Instant getMedidoEn() {
            return medidoEn;
        }
    }

    private static LecturaResponse aDto(UltimaLecturaView l) {
        Instant medidoEn = l.getMedidoEn();
        return new LecturaResponse(
                l.getSensorId(), l.getMetrica(), l.getValor(), l.getUnidad(),
                medidoEn != null ? medidoEn.atOffset(ZoneOffset.UTC) : null,
                l.getEstado());
    }

    private static BigDecimal redondear(BigDecimal valor) {
        return valor == null ? null : valor.setScale(2, RoundingMode.HALF_UP);
    }
}
