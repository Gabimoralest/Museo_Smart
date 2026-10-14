package com.museosmart.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Respuesta uniforme para operaciones sensibles")
public record MensajeResponse(

        @Schema(description = "Mensaje informativo", example = "Si el correo está registrado, recibirá un código.")
        String mensaje
) {
}
