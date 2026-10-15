package com.museosmart.controller;

import com.museosmart.dto.RegistrarVisitaRequest;
import com.museosmart.dto.VisitaRegistradaResponse;
import com.museosmart.service.PopularidadService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Registro publico de interacciones anonimas con exhibiciones. No requiere
 * autenticacion. No recoge datos personales.
 */
@RestController
@RequestMapping("/api/v1/popularidad")
@Tag(name = "Popularidad (público)",
        description = "Registro de interacciones anónimas con exhibiciones activas. No requiere autenticación.")
public class PopularidadController {

    private final PopularidadService popularidadService;

    public PopularidadController(PopularidadService popularidadService) {
        this.popularidadService = popularidadService;
    }

    @PostMapping("/visitas")
    @Operation(summary = "Registrar una interacción con una exhibición",
            description = "Registra una interacción anónima (por ejemplo, abrir la ficha de una "
                    + "exhibición). La exhibición debe existir y estar activa. La deduplicación "
                    + "la aplica el backend: interacciones idénticas de la misma sesión anónima "
                    + "dentro del mismo minuto se contabilizan una sola vez.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Interacción registrada"),
            @ApiResponse(responseCode = "400", description = "Solicitud inválida"),
            @ApiResponse(responseCode = "404", description = "Exhibición no encontrada o inactiva")
    })
    public ResponseEntity<VisitaRegistradaResponse> registrar(@Valid @RequestBody RegistrarVisitaRequest request) {
        boolean registrada = popularidadService.registrarVisita(
                request.exhibicionId(), request.sesionAnonimaId(), request.fuente());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new VisitaRegistradaResponse(registrada, request.exhibicionId()));
    }
}
