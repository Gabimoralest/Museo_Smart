package com.museosmart.controller;

import com.museosmart.dto.CambioContrasenaRequest;
import com.museosmart.dto.LoginRequest;
import com.museosmart.dto.LoginResponse;
import com.museosmart.security.UsuarioAdminPrincipal;
import com.museosmart.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Autenticación", description = "Inicio de sesión y cambio de contraseña administrativos")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    @Operation(summary = "Iniciar sesión",
            description = "Autentica un administrador y devuelve un token JWT Bearer.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Autenticación correcta"),
            @ApiResponse(responseCode = "400", description = "Solicitud inválida"),
            @ApiResponse(responseCode = "401", description = "Credenciales inválidas o cuenta no activa")
    })
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/cambiar-contrasena")
    @Operation(summary = "Cambiar la contraseña del usuario autenticado",
            description = "Cambio obligatorio u ordinario. Requiere autenticación. "
                    + "No permite modificar la contraseña de otra cuenta.")
    @SecurityRequirement(name = "bearerAuth")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Contraseña actualizada"),
            @ApiResponse(responseCode = "400", description = "Solicitud inválida"),
            @ApiResponse(responseCode = "401", description = "No autenticado")
    })
    public ResponseEntity<Void> cambiarContrasena(
            @AuthenticationPrincipal UsuarioAdminPrincipal principal,
            @Valid @RequestBody CambioContrasenaRequest request) {
        authService.cambiarContrasena(principal.getUsername(), request);
        return ResponseEntity.noContent().build();
    }
}
