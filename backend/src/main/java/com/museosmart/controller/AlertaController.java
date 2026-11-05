package com.museosmart.controller;

import com.museosmart.dto.AlertaResponse;
import com.museosmart.dto.AlertaResumenResponse;
import com.museosmart.service.AlertaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Consulta y resolucion de alertas. Requiere rol ADMIN o SUPERADMIN.
 */
@RestController
@RequestMapping("/api/v1/admin/alertas")
@Tag(name = "Alertas",
        description = "Consultas y resolucion de alertas ambientales. Requiere rol ADMIN o SUPERADMIN.")
@SecurityRequirement(name = "bearerAuth")
public class AlertaController {

    private final AlertaService alertaService;

    public AlertaController(AlertaService alertaService) {
        this.alertaService = alertaService;
    }

    @GetMapping
    @Operation(summary = "Listar alertas",
            description = "Por defecto devuelve las alertas activas (ABIERTA/RECONOCIDA). "
                    + "Con ?todas=true devuelve el historico completo.")
    @ApiResponse(responseCode = "200", description = "Listado de alertas")
    public ResponseEntity<List<AlertaResponse>> listar(@RequestParam(defaultValue = "false") boolean todas) {
        var alertas = todas ? alertaService.listarTodas() : alertaService.listarActivas();
        return ResponseEntity.ok(alertas.stream().map(AlertaResponse::from).toList());
    }

    @GetMapping("/resumen")
    @Operation(summary = "Resumen de alertas activas",
            description = "Devuelve el numero de alertas activas (ABIERTA/RECONOCIDA). "
                    + "Se lee de Redis; si Redis no responde, se cuenta en PostgreSQL.")
    @ApiResponse(responseCode = "200", description = "Resumen de alertas")
    public ResponseEntity<AlertaResumenResponse> resumen() {
        return ResponseEntity.ok(new AlertaResumenResponse(alertaService.contarAbiertas()));
    }

    @PatchMapping("/{id}/resolver")
    @Operation(summary = "Resolver una alerta",
            description = "Marca la alerta como RESUELTA si estaba activa.")
    @ApiResponse(responseCode = "200", description = "Alerta resuelta")
    @ApiResponse(responseCode = "404", description = "Alerta no encontrada")
    public ResponseEntity<AlertaResponse> resolver(@PathVariable Long id) {
        return ResponseEntity.ok(AlertaResponse.from(alertaService.resolverPorId(id)));
    }
}
