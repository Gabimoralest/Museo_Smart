package com.museosmart.iot.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.museosmart.entity.MedicionPendiente;
import com.museosmart.entity.MensajeIot;
import com.museosmart.entity.Sensor;
import com.museosmart.entity.Visita;
import com.museosmart.iot.MensajeInvalidoException;
import com.museosmart.iot.MensajeIotValidador;
import com.museosmart.iot.dto.MensajeAmbientalDto;
import com.museosmart.iot.dto.MensajePresenciaDto;
import com.museosmart.repository.MedicionPendienteRepository;
import com.museosmart.repository.MensajeIotRepository;
import com.museosmart.repository.SensorRepository;
import com.museosmart.repository.redis.EstadoSensorRedisRepository;
import com.museosmart.service.AlertaService;
import com.museosmart.service.PopularidadService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Operaciones transaccionales sobre {@code mensaje_iot} y el búfer
 * {@code medicion_pendiente}.
 *
 * <p>Los limites de transaccion son deliberados:</p>
 * <ul>
 *   <li>La recepcion cruda se confirma en su propia transaccion
 *       ({@link Propagation#REQUIRES_NEW}) aunque el procesamiento falle
 *       despues: asi el mensaje siempre queda registrado.</li>
 *   <li>El procesamiento y el estado {@code PROCESADO} se confirman en la
 *       MISMA transaccion, de modo que un mensaje nunca queda marcado como
 *       procesado si sus mediciones no se confirmaron.</li>
 *   <li>El estado {@code ERROR} se marca en una transaccion independiente,
 *       ya que la de procesamiento se revierte.</li>
 * </ul>
 */
@Service
public class MensajeIotService {

    private static final Logger log = LoggerFactory.getLogger(MensajeIotService.class);
    private static final String ESTADO_RECIBIDO = "RECIBIDO";
    private static final String ESTADO_PROCESADO = "PROCESADO";
    private static final String ESTADO_ERROR = "ERROR";

    private final MensajeIotRepository mensajeIotRepository;
    private final MedicionPendienteRepository medicionPendienteRepository;
    private final SensorRepository sensorRepository;
    private final MensajeIotValidador validador;
    private final AlertaService alertaService;
    private final PopularidadService popularidadService;
    private final EstadoSensorRedisRepository estadoSensorRedis;
    private final ObjectMapper objectMapper;

    public MensajeIotService(MensajeIotRepository mensajeIotRepository,
                             MedicionPendienteRepository medicionPendienteRepository,
                             SensorRepository sensorRepository,
                             MensajeIotValidador validador,
                             AlertaService alertaService,
                             PopularidadService popularidadService,
                             EstadoSensorRedisRepository estadoSensorRedis,
                             ObjectMapper objectMapper) {
        this.mensajeIotRepository = mensajeIotRepository;
        this.medicionPendienteRepository = medicionPendienteRepository;
        this.sensorRepository = sensorRepository;
        this.validador = validador;
        this.alertaService = alertaService;
        this.popularidadService = popularidadService;
        this.estadoSensorRedis = estadoSensorRedis;
        this.objectMapper = objectMapper;
    }

    /**
     * Registra el mensaje crudo de forma idempotente en su propia transaccion.
     *
     * @return el id interno si se inserto, o {@code null} si ya existia.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Long registrarRecepcion(UUID mensajeId, String topico, String payload, String sensorCodigo) {
        int insertadas = mensajeIotRepository.insertarSiNoExiste(mensajeId, topico, payload, sensorCodigo);
        if (insertadas == 0) {
            return null;
        }
        return mensajeIotRepository.findByMensajeId(mensajeId)
                .map(MensajeIot::getId)
                .orElse(null);
    }

    /**
     * Procesa el contenido validado y marca {@code PROCESADO} en la misma
     * transaccion.
     *
     * @throws MensajeInvalidoException si el payload no es valido o el sensor
     *         no existe / no corresponde a la ubicacion indicada.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void procesarContenido(UUID mensajeId, String topico, String topicoAmbiental, String topicoPresencia) {
        MensajeIot mensaje = mensajeIotRepository.findByMensajeId(mensajeId)
                .orElseThrow(() -> new MensajeInvalidoException("mensaje no registrado: " + mensajeId));

        if (topicoAmbiental.equals(topico)) {
            procesarAmbiental(mensaje);
        } else if (topicoPresencia.equals(topico)) {
            procesarPresencia(mensaje);
        } else {
            throw new MensajeInvalidoException("topico no soportado: " + topico);
        }

        mensaje.setEstadoProcesamiento(ESTADO_PROCESADO);
        mensaje.setError(null);
        mensaje.setProcesadoEn(OffsetDateTime.now());
        mensajeIotRepository.save(mensaje);
    }

    /** Marca el mensaje como ERROR en una transaccion independiente. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void marcarError(UUID mensajeId, String motivo) {
        mensajeIotRepository.findByMensajeId(mensajeId).ifPresent(mensaje -> {
            mensaje.setEstadoProcesamiento(ESTADO_ERROR);
            mensaje.setError(recortar(motivo));
            mensaje.setProcesadoEn(OffsetDateTime.now());
            mensajeIotRepository.save(mensaje);
        });
    }

    private void procesarAmbiental(MensajeIot mensaje) {
        MensajeAmbientalDto dto = leer(mensaje.getPayload(), MensajeAmbientalDto.class);
        validador.validarAmbiental(dto);

        Sensor sensor = sensorRepository.findByCodigo(dto.sensorCodigo())
                .orElseThrow(() -> new MensajeInvalidoException(
                        "sensor desconocido: " + dto.sensorCodigo()));

        if (!"AMBIENTAL".equals(sensor.getCategoria()) || sensor.getSala() == null) {
            throw new MensajeInvalidoException(
                    "el sensor " + dto.sensorCodigo() + " no es ambiental o no tiene sala");
        }
        // salaId es opcional: la identidad es sensorCodigo y la sala se toma del
        // sensor. Solo se rechaza si el cliente envia una sala que no coincide.
        if (dto.salaId() != null && !sensor.getSala().getId().equals(dto.salaId())) {
            throw new MensajeInvalidoException("el sensor " + dto.sensorCodigo()
                    + " no corresponde a la sala " + dto.salaId());
        }

        guardarMedicion(mensaje, sensor, "TEMPERATURA", dto.temperatura(), "C", dto.timestamp());
        guardarMedicion(mensaje, sensor, "HUMEDAD", dto.humedad(), "%", dto.timestamp());
        guardarMedicion(mensaje, sensor, "LUZ", dto.luminosidad(), "lux", dto.timestamp());

        // Estado actual en Redis (TTL 5 min) DESPUES de confirmar la transaccion:
        // PostgreSQL/outbox siguen siendo la fuente de verdad y no se altera
        // ninguna escritura existente. Redis es solo aceleracion del "ahora".
        guardarEstadoAmbientalEnRedis(sensor, dto.temperatura(), dto.humedad(),
                dto.luminosidad(), dto.timestamp());

        alertaService.evaluarAmbiental(sensor, "TEMPERATURA", dto.temperatura());
        alertaService.evaluarAmbiental(sensor, "HUMEDAD", dto.humedad());
        alertaService.evaluarAmbiental(sensor, "LUZ", dto.luminosidad());
    }

    private void procesarPresencia(MensajeIot mensaje) {
        MensajePresenciaDto dto = leer(mensaje.getPayload(), MensajePresenciaDto.class);
        validador.validarPresencia(dto);

        // Se bloquea la fila del sensor: serializa la lectura y escritura de
        // presencia_actual para que un unico episodio de presencia no se
        // contabilice dos veces ante mensajes concurrentes.
        Sensor sensor = sensorRepository.findByCodigoConBloqueo(dto.sensorCodigo())
                .orElseThrow(() -> new MensajeInvalidoException(
                        "sensor desconocido: " + dto.sensorCodigo()));

        if (!"PRESENCIA".equals(sensor.getCategoria()) || sensor.getExhibicion() == null) {
            throw new MensajeInvalidoException(
                    "el sensor " + dto.sensorCodigo() + " no es de presencia o no tiene exhibicion");
        }
        // exhibicionId es opcional: la identidad es sensorCodigo y la exhibicion
        // se toma del sensor. Solo se rechaza si el cliente envia una que no coincide.
        if (dto.exhibicionId() != null && !sensor.getExhibicion().getId().equals(dto.exhibicionId())) {
            throw new MensajeInvalidoException("el sensor " + dto.sensorCodigo()
                    + " no corresponde a la exhibicion " + dto.exhibicionId());
        }

        BigDecimal valor = dto.presencia() ? BigDecimal.ONE : BigDecimal.ZERO;
        guardarMedicion(mensaje, sensor, "PRESENCIA", valor.doubleValue(), null, dto.timestamp());

        // Estado actual de presencia en Redis (TTL 5 min), tras confirmar.
        boolean hayPresencia = Boolean.TRUE.equals(dto.presencia());
        guardarPresenciaEnRedis(sensor, hayPresencia, dto.timestamp());

        // Flanco de subida: solo cuando la presencia pasa a activa desde un
        // estado distinto (false o desconocido) se contabiliza una visita. Las
        // lecturas periodicas con presencia ya activa no vuelven a contar.
        boolean flancoSubida = hayPresencia && !Boolean.TRUE.equals(sensor.getPresenciaActual());

        // Se comprueba la actividad de la exhibicion ANTES de delegar en
        // PopularidadService: asi una exhibicion inactiva no lanza excepcion que
        // marcaria toda esta transaccion como rollback-only y perderia la
        // medicion de presencia.
        if (flancoSubida && sensor.getExhibicion().isActiva()) {
            // Identidad de visita unica por EPISODIO de presencia, derivada del
            // mensaje_id que representa la transicion. Es determinista (reprocesar
            // el mismo mensaje produce la misma identidad, por lo que uq_visita_dedup
            // lo colapsa) y distinta entre episodios, de modo que dos subidas del
            // mismo sensor y exhibicion dentro del mismo minuto no colisionan.
            // No sustituye a la idempotencia de mensaje_iot.mensaje_id ni al flanco:
            // ambos siguen siendo la primera linea de defensa.
            UUID sesionEpisodio = UUID.nameUUIDFromBytes(
                    ("sensor-episodio:" + mensaje.getMensajeId()).getBytes(StandardCharsets.UTF_8));
            popularidadService.registrarVisita(
                    sensor.getExhibicion().getId(), sesionEpisodio.toString(), Visita.FUENTE_SENSOR);
        }

        sensor.setPresenciaActual(hayPresencia);
        sensorRepository.save(sensor);
    }

    private void guardarMedicion(MensajeIot mensaje, Sensor sensor, String metrica,
                                 double valor, String unidad, OffsetDateTime medidoEn) {
        MedicionPendiente medicion = new MedicionPendiente();
        medicion.setMensajeIot(mensaje);
        medicion.setSensor(sensor);
        medicion.setMetrica(metrica);
        medicion.setValor(BigDecimal.valueOf(valor));
        medicion.setUnidad(unidad);
        medicion.setMedidoEn(medidoEn);
        medicionPendienteRepository.save(medicion);
    }

    /**
     * Guarda el estado actual ambiental en Redis tras el commit. Si Redis falla,
     * el repositorio lo absorbe (aviso en log) y la transaccion no se ve afectada.
     */
    private void guardarEstadoAmbientalEnRedis(Sensor sensor, double temperatura,
                                               double humedad, double luminosidad,
                                               OffsetDateTime medidoEn) {
        ejecutarTrasCommit(() -> estadoSensorRedis.guardarAmbiental(
                sensor, temperatura, humedad, luminosidad, medidoEn, "PENDIENTE"));
    }

    private void guardarPresenciaEnRedis(Sensor sensor, boolean presencia, OffsetDateTime medidoEn) {
        ejecutarTrasCommit(() -> estadoSensorRedis.guardarPresencia(
                sensor, presencia, medidoEn, "PENDIENTE"));
    }

    /**
     * Ejecuta una escritura en Redis solo cuando la transaccion confirma. Asi el
     * estado actual nunca refleja una lectura que PostgreSQL revirtio. Fuera de
     * una transaccion activa se ejecuta de inmediato.
     */
    private void ejecutarTrasCommit(Runnable accion) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    accion.run();
                }
            });
        } else {
            accion.run();
        }
    }

    private <T> T leer(String payload, Class<T> tipo) {
        try {
            return objectMapper.readValue(payload, tipo);
        } catch (JsonProcessingException ex) {
            throw new MensajeInvalidoException("payload malformado: " + ex.getOriginalMessage());
        }
    }

    private String recortar(String texto) {
        if (texto == null) {
            return null;
        }
        return texto.length() <= 2000 ? texto : texto.substring(0, 2000);
    }

    /** Expone el estado RECIBIDO por si una fase posterior lo necesita. */
    public static String estadoRecibido() {
        return ESTADO_RECIBIDO;
    }
}
