package com.museosmart.iot.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.museosmart.entity.MedicionPendiente;
import com.museosmart.entity.MensajeIot;
import com.museosmart.entity.Sensor;
import com.museosmart.iot.MensajeInvalidoException;
import com.museosmart.iot.MensajeIotValidador;
import com.museosmart.iot.dto.MensajeAmbientalDto;
import com.museosmart.iot.dto.MensajePresenciaDto;
import com.museosmart.repository.MedicionPendienteRepository;
import com.museosmart.repository.MensajeIotRepository;
import com.museosmart.repository.SensorRepository;
import com.museosmart.service.AlertaService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
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
    private final ObjectMapper objectMapper;

    public MensajeIotService(MensajeIotRepository mensajeIotRepository,
                             MedicionPendienteRepository medicionPendienteRepository,
                             SensorRepository sensorRepository,
                             MensajeIotValidador validador,
                             AlertaService alertaService,
                             ObjectMapper objectMapper) {
        this.mensajeIotRepository = mensajeIotRepository;
        this.medicionPendienteRepository = medicionPendienteRepository;
        this.sensorRepository = sensorRepository;
        this.validador = validador;
        this.alertaService = alertaService;
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
        if (!sensor.getSala().getId().equals(dto.salaId())) {
            throw new MensajeInvalidoException("el sensor " + dto.sensorCodigo()
                    + " no corresponde a la sala " + dto.salaId());
        }

        guardarMedicion(mensaje, sensor, "TEMPERATURA", dto.temperatura(), "C", dto.timestamp());
        guardarMedicion(mensaje, sensor, "HUMEDAD", dto.humedad(), "%", dto.timestamp());
        guardarMedicion(mensaje, sensor, "LUZ", dto.luminosidad(), "lux", dto.timestamp());

        alertaService.evaluarAmbiental(sensor, "TEMPERATURA", dto.temperatura());
        alertaService.evaluarAmbiental(sensor, "HUMEDAD", dto.humedad());
        alertaService.evaluarAmbiental(sensor, "LUZ", dto.luminosidad());
    }

    private void procesarPresencia(MensajeIot mensaje) {
        MensajePresenciaDto dto = leer(mensaje.getPayload(), MensajePresenciaDto.class);
        validador.validarPresencia(dto);

        Sensor sensor = sensorRepository.findByCodigo(dto.sensorCodigo())
                .orElseThrow(() -> new MensajeInvalidoException(
                        "sensor desconocido: " + dto.sensorCodigo()));

        if (!"PRESENCIA".equals(sensor.getCategoria()) || sensor.getExhibicion() == null) {
            throw new MensajeInvalidoException(
                    "el sensor " + dto.sensorCodigo() + " no es de presencia o no tiene exhibicion");
        }
        if (!sensor.getExhibicion().getId().equals(dto.exhibicionId())) {
            throw new MensajeInvalidoException("el sensor " + dto.sensorCodigo()
                    + " no corresponde a la exhibicion " + dto.exhibicionId());
        }

        BigDecimal valor = dto.presencia() ? BigDecimal.ONE : BigDecimal.ZERO;
        guardarMedicion(mensaje, sensor, "PRESENCIA", valor.doubleValue(), null, dto.timestamp());
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
