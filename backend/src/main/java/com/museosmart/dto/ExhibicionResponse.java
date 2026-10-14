package com.museosmart.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;

@Schema(description = "Exhibición del museo")
public record ExhibicionResponse(

        @Schema(description = "Identificador de la exhibición", example = "1")
        Long id,

        @Schema(description = "Identificador de la sala a la que pertenece", example = "1")
        Long salaId,

        @Schema(description = "Nombre de la sala a la que pertenece", example = "Pintura histórica")
        String salaNombre,

        @Schema(description = "Código estable de la exhibición", example = "pintura-historica-01")
        String codigo,

        @Schema(description = "Título de la exhibición")
        String titulo,

        @Schema(description = "Descripción de la exhibición")
        String descripcion,

        @Schema(description = "Contexto histórico de la exhibición")
        String contextoHistorico,

        @Schema(description = "Autor o cultura")
        String autorCultura,

        @Schema(description = "Período")
        String periodo,

        @Schema(description = "Material")
        String material,

        @Schema(description = "Fecha aproximada de creación (texto libre)")
        String fechaCreacionAprox,

        @Schema(description = "Límite inferior de temperatura en °C")
        BigDecimal tempMinC,

        @Schema(description = "Límite superior de temperatura en °C")
        BigDecimal tempMaxC,

        @Schema(description = "Límite inferior de humedad en %")
        BigDecimal humedadMinPct,

        @Schema(description = "Límite superior de humedad en %")
        BigDecimal humedadMaxPct,

        @Schema(description = "Límite máximo de luz en lux")
        BigDecimal luzMaxLux,

        @Schema(description = "Indica si la exhibición está activa", example = "true")
        boolean activa
) {
}
