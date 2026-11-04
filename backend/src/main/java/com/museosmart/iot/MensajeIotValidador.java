package com.museosmart.iot;

import com.museosmart.iot.dto.MensajeAmbientalDto;
import com.museosmart.iot.dto.MensajePresenciaDto;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Validacion estricta de los payloads MQTT.
 *
 * <p>Rechaza campos ausentes, valores no finitos o fuera de rango y cualquier
 * incoherencia. No aplica valores por defecto a datos invalidos.</p>
 */
@Component
public class MensajeIotValidador {

    private final IotLimitesProperties limites;

    public MensajeIotValidador(IotLimitesProperties limites) {
        this.limites = limites;
    }

    public void validarAmbiental(MensajeAmbientalDto dto) {
        if (dto == null) {
            throw new MensajeInvalidoException("payload vacio");
        }
        validarMensajeId(dto.mensajeId());
        validarCodigo(dto.sensorCodigo());
        if (dto.salaId() != null && dto.salaId() <= 0) {
            throw new MensajeInvalidoException("salaId invalido");
        }
        validarTimestamp(dto.timestamp());
        validarRango("temperatura", dto.temperatura(), limites.getTemperatura());
        validarRango("humedad", dto.humedad(), limites.getHumedad());
        validarRango("luminosidad", dto.luminosidad(), limites.getLuminosidad());
    }

    public void validarPresencia(MensajePresenciaDto dto) {
        if (dto == null) {
            throw new MensajeInvalidoException("payload vacio");
        }
        validarMensajeId(dto.mensajeId());
        validarCodigo(dto.sensorCodigo());
        if (dto.exhibicionId() != null && dto.exhibicionId() <= 0) {
            throw new MensajeInvalidoException("exhibicionId invalido");
        }
        if (dto.presencia() == null) {
            throw new MensajeInvalidoException("presencia ausente");
        }
        validarTimestamp(dto.timestamp());
    }

    private void validarMensajeId(UUID mensajeId) {
        if (mensajeId == null) {
            throw new MensajeInvalidoException("mensajeId ausente");
        }
    }

    private void validarCodigo(String codigo) {
        if (codigo == null || codigo.isBlank()) {
            throw new MensajeInvalidoException("sensorCodigo ausente o vacio");
        }
    }

    private void validarTimestamp(java.time.OffsetDateTime timestamp) {
        if (timestamp == null) {
            throw new MensajeInvalidoException("timestamp ausente");
        }
    }

    private void validarRango(String nombre, Double valor, IotLimitesProperties.Rango rango) {
        if (valor == null) {
            throw new MensajeInvalidoException(nombre + " ausente");
        }
        if (valor.isNaN() || valor.isInfinite()) {
            throw new MensajeInvalidoException(nombre + " no es un numero finito");
        }
        if (!rango.contiene(valor)) {
            throw new MensajeInvalidoException(
                    nombre + " fuera de rango [" + rango.getMin() + ", " + rango.getMax() + "]: " + valor);
        }
    }
}
