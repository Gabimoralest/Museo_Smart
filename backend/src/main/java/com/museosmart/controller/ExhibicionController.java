package com.museosmart.controller;

import com.museosmart.dto.DtoMapper;
import com.museosmart.dto.ExhibicionResponse;
import com.museosmart.entity.ContenidoMultimedia;
import com.museosmart.entity.Exhibicion;
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
import java.util.Map;

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
            description = "Devuelve las exhibiciones activas, incluida la exhibición especial de la plaza central.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Listado de exhibiciones activas")
    })
    public ResponseEntity<List<ExhibicionResponse>> listarActivas() {
        List<Exhibicion> exhibiciones = exhibicionService.listarActivas();
        Map<Long, Map<String, ContenidoMultimedia>> multimedia =
                exhibicionService.multimediaPorExhibicion(exhibiciones);
        List<ExhibicionResponse> respuesta = exhibiciones.stream()
                .map(e -> aDto(e, multimedia))
                .toList();
        return ResponseEntity.ok(respuesta);
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
        Exhibicion exhibicion = exhibicionService.obtenerActivaPorId(id);
        Map<String, ContenidoMultimedia> mm = exhibicionService.multimediaPorTipo(id);
        return ResponseEntity.ok(DtoMapper.toExhibicionResponse(exhibicion,
                mm.get(ContenidoMultimedia.TIPO_IMAGEN), mm.get(ContenidoMultimedia.TIPO_VIDEO)));
    }

    @GetMapping("/salas/{salaId}/exhibiciones")
    @Operation(summary = "Listar exhibiciones de una sala",
            description = "Devuelve las exhibiciones activas de la sala. NO incluye la exhibición especial.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Exhibiciones de la sala"),
            @ApiResponse(responseCode = "404", description = "Sala no encontrada")
    })
    public ResponseEntity<List<ExhibicionResponse>> listarPorSala(
            @Parameter(description = "Identificador de la sala", example = "1")
            @PathVariable Long salaId) {
        List<Exhibicion> exhibiciones = exhibicionService.listarPorSala(salaId);
        Map<Long, Map<String, ContenidoMultimedia>> multimedia =
                exhibicionService.multimediaPorExhibicion(exhibiciones);
        List<ExhibicionResponse> respuesta = exhibiciones.stream()
                .map(e -> aDto(e, multimedia))
                .toList();
        return ResponseEntity.ok(respuesta);
    }

    private ExhibicionResponse aDto(Exhibicion exhibicion,
                                    Map<Long, Map<String, ContenidoMultimedia>> multimedia) {
        Map<String, ContenidoMultimedia> mm = multimedia.getOrDefault(exhibicion.getId(), Map.of());
        return DtoMapper.toExhibicionResponse(exhibicion,
                mm.get(ContenidoMultimedia.TIPO_IMAGEN), mm.get(ContenidoMultimedia.TIPO_VIDEO));
    }
}
