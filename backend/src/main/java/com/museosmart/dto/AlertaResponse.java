package com.museosmart.dto;

import com.museosmart.entity.Alerta;

import java.time.OffsetDateTime;

/**
 * Representacion de una alerta para la API administrativa.
 */
public record AlertaResponse(
        Long id,
        Long sensorId,
        String sensorCodigo,
        String tipo,
        String severidad,
        String estado,
        String descripcion,
        String condicionClave,
        OffsetDateTime iniciadaEn,
        OffsetDateTime resueltaEn
) {
    public static AlertaResponse from(Alerta a) {
        return new AlertaResponse(
                a.getId(),
                a.getSensor() != null ? a.getSensor().getId() : null,
                a.getSensor() != null ? a.getSensor().getCodigo() : null,
                a.getTipo(),
                a.getSeveridad(),
                a.getEstado(),
                a.getDescripcion(),
                a.getCondicionClave(),
                a.getIniciadaEn(),
                a.getResueltaEn());
    }
}
