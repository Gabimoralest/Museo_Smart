package com.museosmart.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Resultado del inicio de sesión")
public record LoginResponse(

        @Schema(description = "Token JWT de acceso (Bearer)")
        String token,

        @Schema(description = "Tipo de token", example = "Bearer")
        String tipo,

        @Schema(description = "Correo del administrador autenticado")
        String correo,

        @Schema(description = "Rol del administrador", example = "ADMIN")
        String rol,

        @Schema(description = "Indica si debe cambiar la contraseña antes de operar",
                example = "false")
        boolean debeCambiarContrasena,

        @Schema(description = "Minutos de validez del token", example = "60")
        long expiraEnMinutos
) {
}
