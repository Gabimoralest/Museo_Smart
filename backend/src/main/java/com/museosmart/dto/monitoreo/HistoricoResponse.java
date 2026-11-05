package com.museosmart.dto.monitoreo;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Serie histórica de una métrica desde InfluxDB.
 *
 * @param metrica          métrica consultada (TEMPERATURA, HUMEDAD o LUZ).
 * @param desde            inicio del rango consultado.
 * @param hasta            fin del rango consultado.
 * @param intervaloMinutos tamaño de la ventana de agregación en minutos
 *                         (1, 5, 15 o 60). La gráfica lo usa para decidir cuándo
 *                         hay un hueco real de datos.
 * @param series           series por sensor (código). Puede estar vacío si no hay datos.
 */
@Schema(description = "Serie histórica de una métrica")
public record HistoricoResponse(
        String metrica,
        OffsetDateTime desde,
        OffsetDateTime hasta,
        int intervaloMinutos,
        List<SerieSensor> series
) {
    /**
     * Serie de un sensor.
     *
     * @param sensor     c��digo del sensor.
     * @param salaId     id de la sala del sensor (o null si no tiene).
     * @param salaOrden  numero de orden de la sala (1..N) para etiquetas legibles.
     * @param salaNombre nombre legible de la sala (o null si no tiene).
     * @param limiteMin  limite ambiental minimo para la metrica (null si no aplica).
     * @param limiteMax  limite ambiental maximo para la metrica (null si no aplica).
     * @param puntos     puntos (tiempo, valor) en orden temporal ascendente.
     */
    public record SerieSensor(String sensor, Long salaId, Integer salaOrden, String salaNombre,
                              Double limiteMin, Double limiteMax,
                              List<PuntoHistorico> puntos) {
    }

    /**
     * Punto de la serie temporal, ya agregado en una ventana.
     *
     * @param tiempo instante de la ventana agregada.
     * @param valor  promedio de la ventana.
     * @param minimo minimo de la ventana (null si no se calculo).
     * @param maximo maximo de la ventana (null si no se calculo).
     */
    public record PuntoHistorico(OffsetDateTime tiempo, double valor,
                                 Double minimo, Double maximo) {
        public PuntoHistorico(OffsetDateTime tiempo, double valor) {
            this(tiempo, valor, null, null);
        }
    }
}
