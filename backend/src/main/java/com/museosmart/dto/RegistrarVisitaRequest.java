package com.museosmart.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;

/**
 * Solicitud para registrar una interacción anónima con una exhibición.
 * No contiene datos personales: la sesión anónima es un UUID opaco que el
 * backend genera si no se aporta.
 */
@Schema(description = "Registro de una interacción anónima con una exhibición activa")
public record RegistrarVisitaRequest(

        @Schema(description = "Identificador de la exhibición", example = "1")
        @NotNull(message = "El identificador de la exhibición es obligatorio")
        @Positive(message = "El identificador de la exhibición debe ser positivo")
        Long exhibicionId,

        @Schema(description = "Identificador opaco de sesión anónima (UUID). Si se omite, "
                + "el backend genera uno nuevo.", example = "3f1a7c2e-9b41-4d6a-8e2f-1c0d5b7a9e34")
        @Pattern(
                regexp = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
                message = "El identificador de sesión anónima debe ser un UUID válido")
        String sesionAnonimaId,

        @Schema(description = "Origen de la interacción", example = "CURSOR",
                allowableValues = {"CURSOR", "SIMULADOR", "SENSOR", "QR", "OTRO"})
        @NotBlank(message = "La fuente es obligatoria")
        @Pattern(regexp = "(?i)(CURSOR|SIMULADOR|SENSOR|QR|OTRO)",
                message = "La fuente debe ser CURSOR, SIMULADOR, SENSOR, QR u OTRO")
        String fuente
) {
}
