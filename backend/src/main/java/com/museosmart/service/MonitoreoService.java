package com.museosmart.service;

import com.museosmart.dto.monitoreo.HistoricoResponse;
import com.museosmart.dto.monitoreo.LecturaResponse;
import com.museosmart.dto.monitoreo.ResumenMonitoreoResponse;
import com.museosmart.dto.monitoreo.SaludOutboxResponse;
import com.museosmart.dto.monitoreo.SensorMonitoreoResponse;
import com.museosmart.entity.Sensor;
import com.museosmart.exception.ReglaNegocioException;
import com.museosmart.iot.influx.InfluxLector;
import com.museosmart.repository.AgregadosOutboxView;
import com.museosmart.repository.ConteoEstadoView;
import com.museosmart.repository.MonitoreoRepository;
import com.museosmart.repository.PromedioMetricaView;
import com.museosmart.repository.UltimaLecturaView;
import com.museosmart.repository.UltimaPresenciaView;
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

    public MonitoreoService(MonitoreoRepository monitoreoRepository, InfluxLector influxLector) {
        this.monitoreoRepository = monitoreoRepository;
        this.influxLector = influxLector;
    }

    /** Lista de sensores con ubicación y últimas lecturas por métrica. */
    public List<SensorMonitoreoResponse> listarSensores() {
        List<Sensor> sensores = monitoreoRepository.listarSensoresConUbicacion();
        Map<Long, List<UltimaLecturaView>> porSensor = agruparLecturas();

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
        return monitoreoRepository.ultimasLecturasPorSensor().stream()
                .map(MonitoreoService::aDto)
                .toList();
    }

    /** Resumen agregado con datos reales. */
    public ResumenMonitoreoResponse resumen() {
        List<Sensor> sensores = monitoreoRepository.listarSensoresConUbicacion();
        Map<Long, List<UltimaLecturaView>> porSensor = agruparLecturas();

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

        List<UltimaPresenciaView> presencias = monitoreoRepository.ultimaPresenciaPorSensor();
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

        String flux = construirFlux(metricaNormalizada, desde, hasta, sensorFiltro);
        Map<String, List<InfluxLector.Punto>> series = influxLector.consultarSeries(flux);

        List<HistoricoResponse.SerieSensor> seriesDto = new ArrayList<>(series.size());
        for (Map.Entry<String, List<InfluxLector.Punto>> entrada : series.entrySet()) {
            List<HistoricoResponse.PuntoHistorico> puntos = entrada.getValue().stream()
                    .map(p -> new HistoricoResponse.PuntoHistorico(
                            p.tiempo().atOffset(ZoneOffset.UTC), p.valor()))
                    .toList();
            seriesDto.add(new HistoricoResponse.SerieSensor(entrada.getKey(), puntos));
        }
        seriesDto.sort(Comparator.comparing(HistoricoResponse.SerieSensor::sensor));

        return new HistoricoResponse(metricaNormalizada, desde, hasta, seriesDto);
    }

    /**
     * Construye la consulta Flux usando el esquema real de escritura:
     * measurement = métrica, tag sensor, field valor.
     */
    private String construirFlux(String metrica, OffsetDateTime desde, OffsetDateTime hasta,
                                 String sensor) {
        Instant ini = desde.toInstant();
        Instant fin = hasta.toInstant();
        StringBuilder sb = new StringBuilder();
        sb.append("from(bucket: \"").append(influxLector.getBucket()).append("\")");
        sb.append(" |> range(start: ").append(ini.toString()).append(", stop: ").append(fin.toString()).append(')');
        sb.append(" |> filter(fn: (r) => r._measurement == \"").append(metrica).append("\")");
        sb.append(" |> filter(fn: (r) => r._field == \"valor\")");
        if (sensor != null) {
            sb.append(" |> filter(fn: (r) => r.sensor == \"").append(sensor).append("\")");
        }
        sb.append(" |> sort(columns: [\"_time\"])");
        return sb.toString();
    }

    private Map<Long, List<UltimaLecturaView>> agruparLecturas() {
        Map<Long, List<UltimaLecturaView>> porSensor = new HashMap<>();
        for (UltimaLecturaView l : monitoreoRepository.ultimasLecturasPorSensor()) {
            porSensor.computeIfAbsent(l.getSensorId(), k -> new ArrayList<>()).add(l);
        }
        return porSensor;
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
