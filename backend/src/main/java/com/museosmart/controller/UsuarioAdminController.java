package com.museosmart.controller;

import com.museosmart.dto.CambioEstadoUsuarioRequest;
import com.museosmart.dto.DtoMapper;
import com.museosmart.dto.UsuarioAdminRequest;
import com.museosmart.dto.UsuarioAdminResponse;
import com.museosmart.service.UsuarioAdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/usuarios")
@Tag(name = "Administración de usuarios",
        description = "Gestión de cuentas de administradores. Requiere rol SUPERADMIN.")
@SecurityRequirement(name = "bearerAuth")
public class UsuarioAdminController {

    private final UsuarioAdminService usuarioAdminService;

    public UsuarioAdminController(UsuarioAdminService usuarioAdminService) {
        this.usuarioAdminService = usuarioAdminService;
    }

    @GetMapping
    @Operation(summary = "Listar administradores",
            description = "Devuelve todas las cuentas de administrador.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Listado de administradores"),
            @ApiResponse(responseCode = "401", description = "No autenticado"),
            @ApiResponse(responseCode = "403", description = "Sin permisos o cambio de contraseña pendiente")
    })
    public ResponseEntity<List<UsuarioAdminResponse>> listar() {
        List<UsuarioAdminResponse> usuarios = usuarioAdminService.listarTodos().stream()
                .map(DtoMapper::toUsuarioAdminResponse)
                .toList();
        return ResponseEntity.ok(usuarios);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Consultar administrador por id",
            description = "Devuelve una cuenta concreta o 404 si no existe.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Administrador encontrado"),
            @ApiResponse(responseCode = "401", description = "No autenticado"),
            @ApiResponse(responseCode = "403", description = "Sin permisos o cambio de contraseña pendiente"),
            @ApiResponse(responseCode = "404", description = "Administrador no encontrado")
    })
    public ResponseEntity<UsuarioAdminResponse> obtener(@PathVariable Long id) {
        return ResponseEntity.ok(DtoMapper.toUsuarioAdminResponse(usuarioAdminService.obtenerPorId(id)));
    }

    @PostMapping
    @Operation(summary = "Crear administrador",
            description = "Crea una cuenta ADMIN. El rol no es asignable: las cuentas del panel son "
                    + "siempre ADMIN. La contraseña es obligatoria y se almacena con hash.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Administrador creado"),
            @ApiResponse(responseCode = "400", description = "Solicitud inválida o intento de asignar otro rol"),
            @ApiResponse(responseCode = "401", description = "No autenticado"),
            @ApiResponse(responseCode = "403", description = "Sin permisos o cambio de contraseña pendiente"),
            @ApiResponse(responseCode = "409", description = "Correo ya registrado")
    })
    public ResponseEntity<UsuarioAdminResponse> crear(
            @Validated(UsuarioAdminRequest.OnCreate.class) @RequestBody UsuarioAdminRequest request) {
        // El rol no se persiste: se rechaza cualquier valor distinto de ADMIN y,
        // en cualquier caso, la cuenta se crea como ADMIN.
        usuarioAdminService.validarRolNoEscalable(request.rol());
        var creado = usuarioAdminService.crear(
                request.nombre(), request.correo(), request.contrasena());
        return ResponseEntity.status(HttpStatus.CREATED).body(DtoMapper.toUsuarioAdminResponse(creado));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Actualizar administrador",
            description = "Actualiza nombre y correo de una cuenta ADMIN. No modifica contraseña ni rol. "
                    + "La cuenta de SuperAdmin no se puede modificar desde el panel.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Administrador actualizado"),
            @ApiResponse(responseCode = "400", description = "Solicitud inválida"),
            @ApiResponse(responseCode = "401", description = "No autenticado"),
            @ApiResponse(responseCode = "403", description = "Sin permisos, cambio de contraseña pendiente "
                    + "o cuenta SuperAdmin protegida"),
            @ApiResponse(responseCode = "404", description = "Administrador no encontrado"),
            @ApiResponse(responseCode = "409", description = "Correo ya registrado")
    })
    public ResponseEntity<UsuarioAdminResponse> actualizar(
            @PathVariable Long id,
            @Validated(UsuarioAdminRequest.OnUpdate.class) @RequestBody UsuarioAdminRequest request) {
        usuarioAdminService.validarRolNoEscalable(request.rol());
        var actualizado = usuarioAdminService.actualizar(id, request.nombre(), request.correo());
        return ResponseEntity.ok(DtoMapper.toUsuarioAdminResponse(actualizado));
    }

    @PatchMapping("/{id}/estado")
    @Operation(summary = "Cambiar estado de un administrador",
            description = "Activa o desactiva una cuenta ADMIN. La cuenta de SuperAdmin no se puede "
                    + "desactivar desde el panel.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Estado actualizado"),
            @ApiResponse(responseCode = "400", description = "Solicitud inválida"),
            @ApiResponse(responseCode = "401", description = "No autenticado"),
            @ApiResponse(responseCode = "403", description = "Sin permisos, cambio de contraseña pendiente "
                    + "o cuenta SuperAdmin protegida"),
            @ApiResponse(responseCode = "404", description = "Administrador no encontrado")
    })
    public ResponseEntity<UsuarioAdminResponse> cambiarEstado(
            @PathVariable Long id,
            @Validated @RequestBody CambioEstadoUsuarioRequest request) {
        var actualizado = usuarioAdminService.cambiarEstado(id, request.estado());
        return ResponseEntity.ok(DtoMapper.toUsuarioAdminResponse(actualizado));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Eliminar administrador",
            description = "Elimina una cuenta ADMIN. La cuenta de SuperAdmin no se puede eliminar.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Administrador eliminado"),
            @ApiResponse(responseCode = "400", description = "Operación no permitida por reglas de negocio"),
            @ApiResponse(responseCode = "401", description = "No autenticado"),
            @ApiResponse(responseCode = "403", description = "Sin permisos, cambio de contraseña pendiente "
                    + "o cuenta SuperAdmin protegida"),
            @ApiResponse(responseCode = "404", description = "Administrador no encontrado")
    })
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        usuarioAdminService.eliminar(id);
        return ResponseEntity.noContent().build();
    }
}
