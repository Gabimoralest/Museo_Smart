package com.museosmart.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Cambio obligatorio de contraseña del usuario autenticado")
public record CambioContrasenaRequest(

        @Schema(description = "Contraseña actual")
        @NotBlank(message = "La contraseña actual es obligatoria")
        String contrasenaActual,

        @Schema(description = "Nueva contraseña (mínimo 8 caracteres)")
        @NotBlank(message = "La nueva contraseña es obligatoria")
        @Size(min = 8, message = "La nueva contraseña debe tener al menos 8 caracteres")
        String nuevaContrasena
) {
}
