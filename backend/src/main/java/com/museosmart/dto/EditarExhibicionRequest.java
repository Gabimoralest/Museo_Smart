package com.museosmart.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Edicion del contenido de una exhibicion (ADMIN/SUPERADMIN).
 *
 * <p>Campos editables: nombre (titulo), descripcion corta, descripcion completa,
 * epoca (periodo), materiales (material), cultura o procedencia
 * (autor_cultura) y dato curioso. Solo <b>nombre</b> y <b>descripcion corta</b>
 * son obligatorios. El codigo, la sala, la categoria y la ubicacion 3D son de
 * solo lectura y se ignoran si llegan en el JSON.</p>
 */
@Schema(description = "Datos editables de una exhibición")
public record EditarExhibicionRequest(

        @Schema(description = "Nombre de la exhibición (obligatorio, máx. 200)",
                example = "Washington cruzando el Delaware")
        @NotBlank(message = "El nombre es obligatorio")
        @Size(max = 200, message = "El nombre no puede superar 200 caracteres")
        String titulo,

        @Schema(description = "Descripción corta (obligatoria, máx. 200)",
                example = "Óleo sobre lienzo de la Guerra de Independencia.")
        @NotBlank(message = "La descripción corta es obligatoria")
        @Size(max = 200, message = "La descripción corta no puede superar 200 caracteres")
        String descripcionCorta,

        @Schema(description = "Descripción completa (opcional)")
        String descripcion,

        @Schema(description = "Época (opcional, máx. 150)", example = "1851")
        @Size(max = 150, message = "La época no puede superar 150 caracteres")
        String periodo,

        @Schema(description = "Materiales (opcional, máx. 200)", example = "Óleo sobre lienzo")
        @Size(max = 200, message = "Los materiales no pueden superar 200 caracteres")
        String material,

        @Schema(description = "Cultura o procedencia (opcional, máx. 200)", example = "Estados Unidos")
        @Size(max = 200, message = "La cultura o procedencia no puede superar 200 caracteres")
        String culturaProcedencia,

        @Schema(description = "Dato curioso (opcional, texto libre)")
        String datoCurioso,

        @Schema(description = "Versión leída por el cliente para el bloqueo optimista", example = "0")
        @NotNull(message = "La versión es obligatoria")
        Integer version
) {
}
