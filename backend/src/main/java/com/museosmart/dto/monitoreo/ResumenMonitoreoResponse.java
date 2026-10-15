package com.museosmart.dto.monitoreo;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.util.List;

/**
 * Resumen del estado del monitoreo IoT, calculado con datos reales.
 *
 * <p>Los promedios se calculan solo sobre lecturas ambientales
 * (TEMPERATURA/HUMEDAD/LUZ) cuya marca temporal esté dentro de la ventana
 * reciente, para no mezclar lecturas antiguas.</p>
 */
@Schema(description = "Resumen del monitoreo IoT")
public record ResumenMonitoreoResponse(
        int totalSensores,
        int sensoresActivos,
        int sensoresConLecturas,
        int sensoresSinLecturas,
        List<PromedioResponse> promediosAmbientales,
        PresenciaResumen presencia
) {
    /** Promedio de una métrica ambiental sobre la ventana reciente. */
    public record PromedioResponse(String metrica, BigDecimal valor, String unidad, long muestras) {
    }

    /**
     * Presencia actual: nº de sensores de presencia (exhibiciones) con última
     * lectura = 1. {@code sensoresConDato} es cuántas exhibiciones reportaron;
     * las que no tienen dato NO se cuentan como 0 (no se inventan).
     */
    public record PresenciaResumen(long exhibicionesConPresencia, long sensoresConDato) {
    }
}
