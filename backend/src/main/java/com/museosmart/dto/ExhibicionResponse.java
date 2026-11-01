package com.museosmart.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;

/**
 * Exhibicion en el catalogo publico (solo activas).
 *
 * <p>Incluye la categoria derivada y la marca {@code especial} para la estatua
 * central. La sala puede ser {@code null} en la exhibicion especial.</p>
 */
@Schema(description = "Exhibición del museo")
public record ExhibicionResponse(

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
        String imagenUrl,
        String videoUrl
) {
}
