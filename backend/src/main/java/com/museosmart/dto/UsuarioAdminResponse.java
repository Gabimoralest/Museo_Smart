package com.museosmart.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;

@Schema(description = "Datos de un administrador expuestos por la API")
public record UsuarioAdminResponse(

        @Schema(description = "Identificador del administrador", example = "1")
        Long id,

        @Schema(description = "Nombre del administrador", example = "Gabs")
        String nombre,

        @Schema(description = "Correo electrónico", example = "admin@museo.com")
        String correo,

        @Schema(description = "Rol del administrador", example = "ADMIN")
        String rol,

        @Schema(description = "Estado de la cuenta", example = "ACTIVO")
        String estado,

        @Schema(description = "Indica si debe cambiar la contraseña en el próximo acceso",
                example = "false")
        boolean primerInicioSesion,

        @Schema(description = "Fecha del último acceso")
        OffsetDateTime ultimoAccesoEn,

        @Schema(description = "Fecha de creación")
        OffsetDateTime creadoEn,

        @Schema(description = "Fecha de última actualización")
        OffsetDateTime actualizadoEn
) {
}
