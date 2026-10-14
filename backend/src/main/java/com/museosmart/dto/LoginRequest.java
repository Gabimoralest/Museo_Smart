package com.museosmart.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "Credenciales de inicio de sesión administrativo")
public record LoginRequest(

        @Schema(description = "Correo del administrador", example = "admin@museo.com")
        @NotBlank(message = "El correo es obligatorio")
        @Email(message = "El correo no tiene un formato válido")
        String correo,

        @Schema(description = "Contraseña", example = "********")
        @NotBlank(message = "La contraseña es obligatoria")
        String contrasena
) {
}
