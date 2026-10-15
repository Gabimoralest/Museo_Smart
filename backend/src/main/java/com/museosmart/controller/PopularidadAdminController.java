package com.museosmart.controller;

import com.museosmart.dto.RankingExhibicionResponse;
import com.museosmart.repository.RankingExhibicionView;
import com.museosmart.service.PopularidadService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Consulta del ranking de popularidad. Requiere rol ADMIN o SUPERADMIN.
 */
@RestController
@RequestMapping("/api/v1/admin/popularidad")
@Tag(name = "Popularidad (administración)",
        description = "Ranking de exhibiciones por popularidad. Requiere rol ADMIN o SUPERADMIN.")
@SecurityRequirement(name = "bearerAuth")
public class PopularidadAdminController {

    private final PopularidadService popularidadService;

    public PopularidadAdminController(PopularidadService popularidadService) {
        this.popularidadService = popularidadService;
    }

    @GetMapping("/ranking")
    @Operation(summary = "Consultar el ranking de popularidad",
            description = "Devuelve las exhibiciones ordenadas por número de interacciones válidas "
                    + "(descendente) y, en caso de empate, alfabéticamente por título. Las "
                    + "exhibiciones sin interacciones aparecen con 0 y comparten la última "
                    + "posición. El parámetro 'limite' es opcional.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Ranking de popularidad"),
            @ApiResponse(responseCode = "400", description = "Parámetro 'limite' inválido"),
            @ApiResponse(responseCode = "401", description = "No autenticado"),
            @ApiResponse(responseCode = "403", description = "Sin permisos o cambio de contraseña pendiente")
    })
    public ResponseEntity<List<RankingExhibicionResponse>> ranking(
            @RequestParam(name = "limite", required = false) Integer limite) {

        List<RankingExhibicionView> filas = (limite == null)
                ? popularidadService.rankingCompleto()
                : popularidadService.rankingLimitado(limite);

        return ResponseEntity.ok(RankingExhibicionResponse.desdeRanking(filas));
    }
}
