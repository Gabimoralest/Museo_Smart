package com.museosmart.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Restablecimiento de contraseña con token de verificación")
public record RestablecerContrasenaRequest(

        @Schema(description = "Token temporal obtenido al verificar el código")
        @NotBlank(message = "El token de restablecimiento es obligatorio")
        String tokenRestablecimiento,

        @Schema(description = "Nueva contraseña (mínimo 8 caracteres)")
        @NotBlank(message = "La nueva contraseña es obligatoria")
        @Size(min = 8, message = "La nueva contraseña debe tener al menos 8 caracteres")
        String nuevaContrasena
) {
}
