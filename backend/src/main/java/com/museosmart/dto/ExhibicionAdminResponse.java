package com.museosmart.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Exhibicion para el listado y el detalle administrativo.
 *
 * <p>Incluye la categoria derivada, la marca de exhibicion especial, el estado
 * de la imagen y las URL de multimedia, ademas de la auditoria y el bloqueo
 * optimista.</p>
 */
@Schema(description = "Exhibición (vista administrativa)")
public record ExhibicionAdminResponse(

        Long id,
        Long salaId,
        String salaNombre,
        String codigo,
        String ubicacion3dCodigo,
        String titulo,
        String descripcionCorta,
        String descripcion,
        String autorCultura,
        String periodo,
        String material,
        String datoCurioso,
        String categoria,
        boolean especial,
        BigDecimal tempMinC,
        BigDecimal tempMaxC,
        BigDecimal humedadMinPct,
        BigDecimal humedadMaxPct,
        BigDecimal luzMaxLux,
        boolean activa,

        @Schema(description = "Indica si la exhibición tiene imagen subida")
        boolean tieneImagen,

        String imagenUrl,
        String videoUrl,

        @Schema(description = "Versión para bloqueo optimista", example = "3")
        Integer version,

        @Schema(description = "Última modificación de contenido (edición)")
        OffsetDateTime actualizadoEn,

        @Schema(description = "Nombre del último administrador que editó el contenido; null si nunca se editó")
        String actualizadoPorNombre
) {
}
