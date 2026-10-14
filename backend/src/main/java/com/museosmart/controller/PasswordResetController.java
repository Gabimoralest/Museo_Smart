package com.museosmart.controller;

import com.museosmart.dto.MensajeResponse;
import com.museosmart.dto.RestablecerContrasenaRequest;
import com.museosmart.dto.SolicitarRecuperacionRequest;
import com.museosmart.dto.VerificarCodigoRequest;
import com.museosmart.dto.VerificarCodigoResponse;
import com.museosmart.service.PasswordResetService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth/recuperacion")
@Tag(name = "Recuperación de contraseña",
        description = "Flujo público de recuperación mediante código de verificación")
public class PasswordResetController {

    private static final String MENSAJE_UNIFORME =
            "Si el correo está registrado, recibirá un código de recuperación.";

    private final PasswordResetService passwordResetService;

    public PasswordResetController(PasswordResetService passwordResetService) {
        this.passwordResetService = passwordResetService;
    }

    @PostMapping("/solicitar")
    @Operation(summary = "Solicitar código de recuperación",
            description = "Respuesta uniforme. No revela si el correo existe.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Solicitud procesada"),
            @ApiResponse(responseCode = "400", description = "Solicitud inválida")
    })
    public ResponseEntity<MensajeResponse> solicitar(@Valid @RequestBody SolicitarRecuperacionRequest request) {
        passwordResetService.solicitar(request.correo());
        return ResponseEntity.ok(new MensajeResponse(MENSAJE_UNIFORME));
    }

    @PostMapping("/verificar")
    @Operation(summary = "Verificar el código de recuperación",
            description = "Devuelve un token temporal para restablecer la contraseña. Nunca devuelve el código.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Código verificado"),
            @ApiResponse(responseCode = "400", description = "Solicitud inválida o código no válido")
    })
    public ResponseEntity<VerificarCodigoResponse> verificar(@Valid @RequestBody VerificarCodigoRequest request) {
        return ResponseEntity.ok(passwordResetService.verificar(request));
    }

    @PostMapping("/restablecer")
    @Operation(summary = "Restablecer la contraseña",
            description = "Usa el token temporal obtenido al verificar. El código se consume una sola vez.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Contraseña restablecida"),
            @ApiResponse(responseCode = "400", description = "Token inválido, expirado o solicitud inválida")
    })
    public ResponseEntity<Void> restablecer(@Valid @RequestBody RestablecerContrasenaRequest request) {
        passwordResetService.restablecer(request);
        return ResponseEntity.noContent().build();
    }
}
