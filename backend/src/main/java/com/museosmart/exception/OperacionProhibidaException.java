package com.museosmart.exception;

/**
 * Operacion prohibida por las reglas del modelo de usuarios (HTTP 403).
 *
 * <p>Se usa, por ejemplo, cuando un SUPERADMIN intenta editar, desactivar o
 * eliminar la cuenta de SuperAdmin desde el panel.</p>
 */
public class OperacionProhibidaException extends RuntimeException {

    public OperacionProhibidaException(String mensaje) {
        super(mensaje);
    }
}
