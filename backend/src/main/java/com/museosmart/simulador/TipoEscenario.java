package com.museosmart.simulador;

/** Tipos de escenario admitidos por el simulador. */
public enum TipoEscenario {
    FALLA_CLIMA,
    HUMEDAD_ALTA,
    EXCESO_LUZ,
    GRUPO_VISITANTES,
    SENSOR_DESCONECTADO;

    /**
     * Normaliza el texto recibido. Devuelve null si el tipo no existe.
     */
    public static TipoEscenario desde(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        try {
            return TipoEscenario.valueOf(valor.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
