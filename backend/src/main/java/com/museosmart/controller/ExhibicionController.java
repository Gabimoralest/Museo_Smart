package com.museosmart.controller;

import com.museosmart.dto.DtoMapper;
import com.museosmart.dto.ExhibicionResponse;
import com.museosmart.service.ExhibicionService;
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
@RequestMapping("/api/v1")
@Tag(name = "Exhibiciones", description = "Consulta de exhibiciones del museo (acceso público)")
public class ExhibicionController {

    private final ExhibicionService exhibicionService;

    public ExhibicionController(ExhibicionService exhibicionService) {
        this.exhibicionService = exhibicionService;
    }

    @GetMapping("/exhibiciones")
    @Operation(summary = "Listar exhibiciones activas",
            description = "Devuelve únicamente las exhibiciones activas destinadas a la visita pública.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Listado de exhibiciones activas")
    })
    public ResponseEntity<List<ExhibicionResponse>> listarActivas() {
        List<ExhibicionResponse> exhibiciones = exhibicionService.listarActivas().stream()
                .map(DtoMapper::toExhibicionResponse)
                .toList();
        return ResponseEntity.ok(exhibiciones);
    }

    @GetMapping("/exhibiciones/{id}")
    @Operation(summary = "Consultar exhibición por id",
            description = "Devuelve una exhibición activa o 404 si no existe o no está activa.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Exhibición encontrada"),
            @ApiResponse(responseCode = "404", description = "Exhibición no encontrada o inactiva")
    })
    public ResponseEntity<ExhibicionResponse> obtenerExhibicion(
            @Parameter(description = "Identificador de la exhibición", example = "1")
            @PathVariable Long id) {
        return ResponseEntity.ok(DtoMapper.toExhibicionResponse(exhibicionService.obtenerActivaPorId(id)));
    }

    @GetMapping("/salas/{salaId}/exhibiciones")
    @Operation(summary = "Listar exhibiciones de una sala",
            description = "Devuelve las exhibiciones de la sala indicada o 404 si la sala no existe.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Exhibiciones de la sala"),
            @ApiResponse(responseCode = "404", description = "Sala no encontrada")
    })
    public ResponseEntity<List<ExhibicionResponse>> listarPorSala(
            @Parameter(description = "Identificador de la sala", example = "1")
            @PathVariable Long salaId) {
        List<ExhibicionResponse> exhibiciones = exhibicionService.listarPorSala(salaId).stream()
                .map(DtoMapper::toExhibicionResponse)
                .toList();
        return ResponseEntity.ok(exhibiciones);
    }
}
