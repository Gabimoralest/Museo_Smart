package com.museosmart.iot;

/**
 * Error de validacion de un mensaje MQTT (payload malformado, campos ausentes,
 * valores fuera de rango, incoherencia con el topico o con el sensor).
 *
 * <p>El mensaje se persiste igualmente en {@code mensaje_iot} con estado
 * {@code ERROR} y este motivo; nunca se convierte silenciosamente en un valor
 * por defecto.</p>
 */
public class MensajeInvalidoException extends RuntimeException {

    public MensajeInvalidoException(String mensaje) {
        super(mensaje);
    }
}
