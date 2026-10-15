package com.museosmart.dto.monitoreo;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.Map;

/**
 * Estado del outbox {@code medicion_pendiente} (contadores reales por estado y
 * agregados de reintentos/errores). No incluye tokens, credenciales ni el texto
 * de los errores.
 *
 * <p>No se calcula un "estado de salud" global: no existe una regla fiable que
 * lo determine (depende de si InfluxDB está disponible y de la política de
 * reintentos). Se exponen los contadores para que la UI los interprete.</p>
 *
 * @param total                total de mediciones en el outbox.
 * @param porEstado            contadores por estado real
 *                             (PENDIENTE/ENVIANDO/ENVIADO/ERROR).
 * @param pendientes           mediciones en estado PENDIENTE.
 * @param enviadas             mediciones en estado ENVIADO.
 * @param enError              mediciones en estado ERROR.
 * @param intentosTotales      suma de reintentos acumulados.
 * @param maxIntentos          máximo de reintentos registrado en una medición.
 * @param conReintentoProgramado mediciones con próximo intento agendado.
 */
@Schema(description = "Estado del outbox de lecturas hacia InfluxDB")
public record SaludOutboxResponse(
        long total,
        Map<String, Long> porEstado,
        long pendientes,
        long enviadas,
        long enError,
        long intentosTotales,
        long maxIntentos,
        long conReintentoProgramado
) {
}
