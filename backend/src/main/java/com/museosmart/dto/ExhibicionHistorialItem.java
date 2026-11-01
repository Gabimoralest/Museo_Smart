package com.museosmart.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;

/**
 * Entrada unificada del historial de una exhibicion: mezcla ediciones de campos
 * (tabla {@code exhibicion_edicion_historial}) y cambios de estado
 * (tabla {@code exhibicion_estado_historial}), ordenadas por fecha descendente.
 */
@Schema(description = "Entrada del historial de una exhibición")
public record ExhibicionHistorialItem(

        @Schema(description = "Tipo de evento: EDICION o ESTADO", example = "EDICION")
        String tipo,

        @Schema(description = "Fecha del evento")
        OffsetDateTime fecha,

        @Schema(description = "Nombre del administrador que lo hizo; null si se desconoce")
        String usuario,

        @Schema(description = "Campo afectado (titulo, descripcion, autor_cultura o activa)")
        String campo,

        @Schema(description = "Valor anterior")
        String valorAnterior,

        @Schema(description = "Valor nuevo")
        String valorNuevo,

        @Schema(description = "Motivo, solo en cambios de estado")
        String motivo
) {
}
