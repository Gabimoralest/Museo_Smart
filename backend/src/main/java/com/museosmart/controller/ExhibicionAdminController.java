package com.museosmart.controller;

import com.museosmart.dto.CambioEstadoRequest;
import com.museosmart.dto.DtoMapper;
import com.museosmart.dto.ExhibicionResponse;
import com.museosmart.security.UsuarioAdminPrincipal;
import com.museosmart.service.ExhibicionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Administracion de exhibiciones. Las exhibiciones son fijas (2 por sala, 8 en
 * total, ligadas al modelo 3D): no se crean, editan ni eliminan desde la API.
 * El administrador unicamente puede activarlas o desactivarlas.
 *
 * La creacion y edicion de exhibiciones quedan como posible mejora futura.
 */
@RestController
@RequestMapping("/api/v1/admin/exhibiciones")
@Tag(name = "Administración de exhibiciones",
        description = "Consulta y activación/desactivación de exhibiciones. Requiere rol ADMIN o SUPERADMIN.")
@SecurityRequirement(name = "bearerAuth")
public class ExhibicionAdminController {

    private final ExhibicionService exhibicionService;

    public ExhibicionAdminController(ExhibicionService exhibicionService) {
        this.exhibicionService = exhibicionService;
    }

    @GetMapping
    @Operation(summary = "Listar todas las exhibiciones",
            description = "Devuelve todas las exhibiciones, incluidas las desactivadas, "
                    + "para gestionar su estado.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Listado de exhibiciones"),
            @ApiResponse(responseCode = "401", description = "No autenticado"),
            @ApiResponse(responseCode = "403", description = "Sin permisos o cambio de contraseña pendiente")
    })
    public ResponseEntity<List<ExhibicionResponse>> listar() {
        List<ExhibicionResponse> exhibiciones = exhibicionService.listarTodas().stream()
                .map(DtoMapper::toExhibicionResponse)
                .toList();
        return ResponseEntity.ok(exhibiciones);
    }

    @PatchMapping("/{id}/estado")
    @Operation(summary = "Activar o desactivar exhibición",
            description = "Cambia el estado lógico. El historial se registra automáticamente. "
                    + "No elimina físicamente la exhibición.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Estado actualizado"),
            @ApiResponse(responseCode = "400", description = "Solicitud inválida"),
            @ApiResponse(responseCode = "401", description = "No autenticado"),
            @ApiResponse(responseCode = "403", description = "Sin permisos o cambio de contraseña pendiente"),
            @ApiResponse(responseCode = "404", description = "Exhibición no encontrada")
    })
    public ResponseEntity<ExhibicionResponse> cambiarEstado(
            @PathVariable Long id,
            @Valid @RequestBody CambioEstadoRequest request,
            @AuthenticationPrincipal UsuarioAdminPrincipal principal) {
        Long usuarioId = principal != null ? principal.getId() : null;
        return ResponseEntity.ok(
                DtoMapper.toExhibicionResponse(exhibicionService.cambiarEstado(id, request, usuarioId)));
    }
}
