package com.museosmart.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Resultado del registro de una interacción.
 *
 * @param registrada  {@code true} si se contabilizó una interacción nueva;
 *                    {@code false} si fue deduplicada por otra igual dentro de
 *                    la misma ventana de tiempo.
 * @param exhibicionId identificador de la exhibición afectada.
 */
@Schema(description = "Resultado del registro de una interacción con una exhibición")
public record VisitaRegistradaResponse(

        @Schema(description = "Indica si la interacción se contabilizó (false si fue deduplicada)",
                example = "true")
        boolean registrada,

        @Schema(description = "Identificador de la exhibición", example = "1")
        Long exhibicionId
) {
}
