package com.museosmart.controller;

import com.museosmart.dto.DtoMapper;
import com.museosmart.dto.SalaResponse;
import com.museosmart.service.SalaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/salas")
@Tag(name = "Salas", description = "Consulta de las salas del museo (acceso público)")
public class SalaController {

    private final SalaService salaService;

    public SalaController(SalaService salaService) {
        this.salaService = salaService;
    }

    @GetMapping
    @Operation(summary = "Listar salas",
            description = "Devuelve todas las salas ordenadas según su orden de presentación.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Listado de salas")
    })
    public ResponseEntity<List<SalaResponse>> listarSalas() {
        List<SalaResponse> salas = salaService.listarTodas().stream()
                .map(DtoMapper::toSalaResponse)
                .toList();
        return ResponseEntity.ok(salas);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Consultar sala por id",
            description = "Devuelve una sala concreta o 404 si no existe.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Sala encontrada"),
            @ApiResponse(responseCode = "404", description = "Sala no encontrada")
    })
    public ResponseEntity<SalaResponse> obtenerSala(
            @Parameter(description = "Identificador de la sala", example = "1")
            @PathVariable Long id) {
        return ResponseEntity.ok(DtoMapper.toSalaResponse(salaService.obtenerPorId(id)));
    }
}
