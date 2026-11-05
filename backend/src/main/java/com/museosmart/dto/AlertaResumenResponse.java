package com.museosmart.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Resumen de alertas para la campana del panel.
 *
 * @param abiertas numero de alertas activas (ABIERTA/RECONOCIDA). Leido de
 *                 Redis; si Redis no esta disponible se cuenta en PostgreSQL.
 */
@Schema(description = "Resumen de alertas activas")
public record AlertaResumenResponse(long abiertas) {
}
