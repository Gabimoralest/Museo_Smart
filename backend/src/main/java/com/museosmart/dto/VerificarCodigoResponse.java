package com.museosmart.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Resultado de la verificación del código")
public record VerificarCodigoResponse(

        @Schema(description = "Token temporal que autoriza el restablecimiento (no es el código)")
        String tokenRestablecimiento,

        @Schema(description = "Minutos de validez del token", example = "15")
        long expiraEnMinutos
) {
}
