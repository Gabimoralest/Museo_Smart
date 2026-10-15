package com.museosmart.dto.monitoreo;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Representación de un sensor para la API de monitoreo, con su ubicación y su
 * última lectura por métrica. No expone la entidad interna.
 *
 * @param categoria    AMBIENTAL o PRESENCIA.
 * @param estado       Estado del dispositivo en la base de datos
 *                     (ACTIVO/INACTIVO/MANTENIMIENTO); no describe la
 *                     conectividad en tiempo real.
 * @param tieneLecturas Indica si existe al menos una lectura registrada.
 * @param ultimaLecturaEn instante de la lectura más reciente, o null.
 * @param lecturas     Últimas lecturas por métrica (puede estar vacío).
 */
@Schema(description = "Sensor de monitoreo con su ubicación y últimas lecturas")
public record SensorMonitoreoResponse(
        Long id,
        String codigo,
        String tipo,
        String categoria,
        String estado,
        Long salaId,
        String salaNombre,
        Long exhibicionId,
        String exhibicionTitulo,
        boolean tieneLecturas,
        OffsetDateTime ultimaLecturaEn,
        List<LecturaResponse> lecturas
) {
}
