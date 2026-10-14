package com.museosmart.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;
import java.util.Map;

@Schema(description = "Estructura uniforme de error de la API")
public record ApiErrorResponse(

        @Schema(description = "Fecha y hora del error")
        OffsetDateTime timestamp,

        @Schema(description = "Código de estado HTTP", example = "404")
        int status,

        @Schema(description = "Descripción corta del estado HTTP", example = "Not Found")
        String error,

        @Schema(description = "Mensaje comprensible del error")
        String mensaje,

        @Schema(description = "Ruta solicitada", example = "/api/v1/salas/99")
        String ruta,

        @Schema(description = "Errores de validación por campo (solo en 400 de validación)")
        Map<String, String> erroresValidacion
) {
}
