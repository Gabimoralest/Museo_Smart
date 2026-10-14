package com.museosmart.mail;

import java.util.ArrayList;
import java.util.List;

/**
 * Utilidad de diagnostico de errores de correo.
 *
 * Construye una descripcion de la cadena de causas de una excepcion (tipo +
 * mensaje) para localizar fallos de SMTP (autenticacion, conexion, TLS, etc.)
 * sin exponer secretos.
 *
 * Seguridad: NO incluye el cuerpo del correo ni el codigo de recuperacion
 * (no forman parte de la excepcion de SMTP). Solo registra tipos de excepcion y
 * mensajes tecnicos, truncados para evitar volcados largos.
 */
public final class MailErrorDiagnostics {

    private static final int MAX_MENSAJE = 300;

    private MailErrorDiagnostics() {
    }

    public static String describir(Throwable error) {
        if (error == null) {
            return "sin causa";
        }
        List<String> partes = new ArrayList<>();
        Throwable actual = error;
        int nivel = 0;
        while (actual != null && nivel < 10) {
            String mensaje = actual.getMessage();
            partes.add(actual.getClass().getName()
                    + (mensaje != null ? ": " + truncar(mensaje) : ""));
            actual = actual.getCause();
            nivel++;
        }
        return String.join(" <- ", partes);
    }

    static Throwable causaRaiz(Throwable error) {        if (error == null) {
            return null;
        }
        Throwable actual = error;
        while (actual.getCause() != null) {
            actual = actual.getCause();
        }
        return actual;
    }

    private static String truncar(String valor) {
        String limpio = valor.replaceAll("[\\r\\n]+", " ").trim();
        return limpio.length() > MAX_MENSAJE ? limpio.substring(0, MAX_MENSAJE) + "..." : limpio;
    }
}
