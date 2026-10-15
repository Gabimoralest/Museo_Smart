package com.museosmart.dto.monitoreo;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Última lectura conocida de una métrica concreta de un sensor.
 *
 * @param estadoOutbox Estado de envío hacia InfluxDB
 *                     (PENDIENTE/ENVIANDO/ENVIADO/ERROR). No indica validez de
 *                     la lectura, solo su trazabilidad de envío.
 */
@Schema(description = "Última lectura de una métrica de un sensor")
public record LecturaResponse(
        Long sensorId,
        String metrica,
        BigDecimal valor,
        String unidad,
        OffsetDateTime medidoEn,
        String estadoOutbox
) {
}
