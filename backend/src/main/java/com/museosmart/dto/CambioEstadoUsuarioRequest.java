package com.museosmart.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

@Schema(description = "Cambio de estado de una cuenta de administrador")
public record CambioEstadoUsuarioRequest(

        @Schema(description = "Nuevo estado de la cuenta", example = "INACTIVO",
                allowableValues = {"ACTIVO", "INACTIVO", "BLOQUEADO"})
        @NotBlank(message = "El estado es obligatorio")
        @Pattern(regexp = "ACTIVO|INACTIVO|BLOQUEADO",
                message = "El estado debe ser ACTIVO, INACTIVO o BLOQUEADO")
        String estado,

        @Schema(description = "Motivo del cambio (opcional)")
        String motivo
) {
}
