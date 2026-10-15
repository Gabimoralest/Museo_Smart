package com.museosmart.dto.monitoreo;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Serie histórica de una métrica desde InfluxDB.
 *
 * @param metrica métrica consultada (TEMPERATURA, HUMEDAD o LUZ).
 * @param desde   inicio del rango consultado.
 * @param hasta   fin del rango consultado.
 * @param series  series por sensor (código). Puede estar vacío si no hay datos.
 */
@Schema(description = "Serie histórica de una métrica")
public record HistoricoResponse(
        String metrica,
        OffsetDateTime desde,
        OffsetDateTime hasta,
        List<SerieSensor> series
) {
    /**
     * Serie de un sensor.
     *
     * @param sensor código del sensor.
     * @param puntos puntos (tiempo, valor) en orden temporal ascendente.
     */
    public record SerieSensor(String sensor, List<PuntoHistorico> puntos) {
    }

    /** Punto de la serie temporal. */
    public record PuntoHistorico(OffsetDateTime tiempo, double valor) {
    }
}
