package com.museosmart.simulador;

import com.museosmart.security.UsuarioAdminPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Escenarios de demostracion del simulador IoT.
 *
 * <p>Solo existe cuando {@code APP_SIMULADOR_HABILITADO=true}; con el flag en
 * false la ruta no esta registrada y responde 404. Ademas exige rol
 * SUPERADMIN (ver SecurityConfig).</p>
 */
@RestController
@RequestMapping("/api/v1/admin/simulador")
@ConditionalOnProperty(name = "app.simulador.habilitado", havingValue = "true")
@Tag(name = "Simulador IoT",
        description = "Escenarios de demostracion. Requiere rol SUPERADMIN y APP_SIMULADOR_HABILITADO=true.")
@SecurityRequirement(name = "bearerAuth")
public class SimuladorController {

    private final SimuladorService simuladorService;

    public SimuladorController(SimuladorService simuladorService) {
        this.simuladorService = simuladorService;
    }

    @GetMapping("/escenarios")
    @Operation(summary = "Escenarios activos",
            description = "Estado publicado por Node-RED en museo/simulador/estado (retained).")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Estado actual"),
            @ApiResponse(responseCode = "403", description = "Sin permisos"),
            @ApiResponse(responseCode = "404", description = "Simulador deshabilitado")
    })
    public ResponseEntity<SimuladorEstadoResponse> escenarios() {
        return ResponseEntity.ok(simuladorService.estado());
    }

    @PostMapping("/escenarios")
    @Operation(summary = "Activar un escenario",
            description = "Publica la orden en museo/simulador/escenario. Los escenarios "
                    + "expiran solos a los 10 minutos (GRUPO_VISITANTES a los 2).")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Escenario enviado"),
            @ApiResponse(responseCode = "400", description = "Tipo o parametros invalidos"),
            @ApiResponse(responseCode = "403", description = "Sin permisos"),
            @ApiResponse(responseCode = "404", description = "Simulador deshabilitado o sala inexistente")
    })
    public ResponseEntity<SimuladorEstadoResponse> activar(
            @Valid @RequestBody EscenarioRequest request,
            @AuthenticationPrincipal UsuarioAdminPrincipal principal) {
        return ResponseEntity.ok(simuladorService.activar(request, actor(principal)));
    }

    @PostMapping("/restablecer")
    @Operation(summary = "Restablecer escenarios",
            description = "Restablece una sala o todos los escenarios; los valores vuelven "
                    + "gradualmente al rango normal y las alertas se resuelven solas.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Restablecimiento enviado"),
            @ApiResponse(responseCode = "403", description = "Sin permisos"),
            @ApiResponse(responseCode = "404", description = "Simulador deshabilitado o sala inexistente")
    })
    public ResponseEntity<SimuladorEstadoResponse> restablecer(
            @RequestBody RestablecerRequest request,
            @AuthenticationPrincipal UsuarioAdminPrincipal principal) {
        return ResponseEntity.ok(simuladorService.restablecer(request, actor(principal)));
    }

    @PostMapping("/horario")
    @Operation(summary = "Horario de visita forzado",
            description = "Hace que el simulador se comporte como a las 11:00 (util para "
                    + "demostrar de noche).")
    @ApiResponse(responseCode = "200", description = "Orden enviada")
    public ResponseEntity<SimuladorEstadoResponse> horario(
            @RequestBody HorarioRequest request,
            @AuthenticationPrincipal UsuarioAdminPrincipal principal) {
        return ResponseEntity.ok(simuladorService.horarioForzado(
                Boolean.TRUE.equals(request.activo()), actor(principal)));
    }

    private static String actor(UsuarioAdminPrincipal principal) {
        return principal != null ? principal.getUsername() : "desconocido";
    }

    /** Solicitud del interruptor de horario forzado. */
    public record HorarioRequest(Boolean activo) {
    }
}
