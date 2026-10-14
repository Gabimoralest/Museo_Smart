package com.museosmart.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Sala del museo")
public record SalaResponse(

        @Schema(description = "Identificador de la sala", example = "1")
        Long id,

        @Schema(description = "Nombre de la sala", example = "Pintura histórica")
        String nombre,

        @Schema(description = "Descripción de la sala")
        String descripcion,

        @Schema(description = "Estado de la sala", example = "activa")
        String estado,

        @Schema(description = "Orden de presentación", example = "1")
        Short orden
) {
}
