package com.museosmart.iot;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.museosmart.iot.service.MensajeIotService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.UUID;

/**
 * Orquesta el registro idempotente y el procesamiento de un mensaje MQTT.
 *
 * <p>Flujo: extrae el {@code mensajeId} y el {@code sensorCodigo} del payload;
 * registra el crudo de forma idempotente; si es nuevo, intenta procesarlo. Un
 * fallo de validacion o de integridad marca el mensaje como {@code ERROR} sin
 * marcarlo nunca como {@code PROCESADO}.</p>
 */
@Component
public class MqttMensajeProcesador {

    private static final Logger log = LoggerFactory.getLogger(MqttMensajeProcesador.class);

    private final MensajeIotService service;
    private final IotMqttProperties propiedades;
    private final ObjectMapper objectMapper;

    public MqttMensajeProcesador(MensajeIotService service,
                                 IotMqttProperties propiedades,
                                 ObjectMapper objectMapper) {
        this.service = service;
        this.propiedades = propiedades;
        this.objectMapper = objectMapper;
    }

    public void procesar(String topico, byte[] payloadBytes) {
        String payload = new String(payloadBytes, StandardCharsets.UTF_8);

        Optional<UUID> mensajeId = extraerMensajeId(payload);
        if (mensajeId.isEmpty()) {
            log.warn("MQTT [{}] descartado: falta mensajeId valido o payload no es JSON", topico);
            return;
        }

        String sensorCodigo = extraerCampoTexto(payload, "sensorCodigo");

        Long id = service.registrarRecepcion(mensajeId.get(), topico, payload, sensorCodigo);
        if (id == null) {
            log.debug("MQTT [{}] mensajeId {} ya registrado: ignorado (idempotencia)",
                    topico, mensajeId.get());
            return;
        }

        try {
            service.procesarContenido(mensajeId.get(), topico,
                    propiedades.getTopicoAmbiental(), propiedades.getTopicoPresencia());
            log.info("MQTT [{}] mensajeId {} procesado correctamente", topico, mensajeId.get());
        } catch (MensajeInvalidoException ex) {
            log.warn("MQTT [{}] mensajeId {} invalido: {}", topico, mensajeId.get(), ex.getMessage());
            service.marcarError(mensajeId.get(), ex.getMessage());
        } catch (RuntimeException ex) {
            log.error("MQTT [{}] mensajeId {} fallo al procesar", topico, mensajeId.get(), ex);
            service.marcarError(mensajeId.get(), "fallo de procesamiento: " + ex.getMessage());
        }
    }

    private Optional<UUID> extraerMensajeId(String payload) {
        try {
            JsonNode nodo = objectMapper.readTree(payload).path("mensajeId");
            if (nodo.isMissingNode() || nodo.isNull()) {
                return Optional.empty();
            }
            return Optional.of(UUID.fromString(nodo.asText()));
        } catch (Exception ex) {
            return Optional.empty();
        }
    }

    private String extraerCampoTexto(String payload, String campo) {
        try {
            JsonNode nodo = objectMapper.readTree(payload).path(campo);
            return nodo.isTextual() ? nodo.asText() : null;
        } catch (Exception ex) {
            return null;
        }
    }
}
