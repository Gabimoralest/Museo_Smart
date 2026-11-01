package com.museosmart.controller;

import com.museosmart.dto.CambioEstadoRequest;
import com.museosmart.dto.DtoMapper;
import com.museosmart.dto.EditarExhibicionRequest;
import com.museosmart.dto.ExhibicionAdminResponse;
import com.museosmart.dto.ExhibicionHistorialItem;
import com.museosmart.entity.ContenidoMultimedia;
import com.museosmart.entity.Exhibicion;
import com.museosmart.security.UsuarioAdminPrincipal;
import com.museosmart.service.ExhibicionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * Administracion de exhibiciones (ADMIN y SUPERADMIN).
 *
 * <p>Las exhibiciones son fijas (2 por sala + la estatua central): no se crean
 * ni eliminan. Se edita su contenido, se activan/desactivan y se gestiona su
 * multimedia (1 imagen obligatoria para activar + 1 video opcional).</p>
 */
@RestController
@RequestMapping("/api/v1/admin/exhibiciones")
@Tag(name = "Administración de exhibiciones",
        description = "Edición, activación/desactivación y multimedia. Requiere ADMIN o SUPERADMIN.")
@SecurityRequirement(name = "bearerAuth")
public class ExhibicionAdminController {

    private final ExhibicionService exhibicionService;

    public ExhibicionAdminController(ExhibicionService exhibicionService) {
        this.exhibicionService = exhibicionService;
    }

    @GetMapping
    @Operation(summary = "Listar todas las exhibiciones",
            description = "Incluye la exhibición especial, categoría, estado de imagen y URL de multimedia.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Listado de exhibiciones"),
            @ApiResponse(responseCode = "401", description = "No autenticado"),
            @ApiResponse(responseCode = "403", description = "Sin permisos o cambio de contraseña pendiente")
    })
    public ResponseEntity<List<ExhibicionAdminResponse>> listar() {
        List<Exhibicion> exhibiciones = exhibicionService.listarTodas();
        Map<Long, String> nombres = exhibicionService.nombresActualizador(exhibiciones);
        Map<Long, Map<String, ContenidoMultimedia>> multimedia =
                exhibicionService.multimediaPorExhibicion(exhibiciones);
        List<ExhibicionAdminResponse> respuesta = exhibiciones.stream()
                .map(e -> aDto(e, nombres, multimedia))
                .toList();
        return ResponseEntity.ok(respuesta);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Detalle de una exhibición",
            description = "Devuelve todos los campos editables, la identificación y el multimedia.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Exhibición encontrada"),
            @ApiResponse(responseCode = "401", description = "No autenticado"),
            @ApiResponse(responseCode = "403", description = "Sin permisos o cambio de contraseña pendiente"),
            @ApiResponse(responseCode = "404", description = "Exhibición no encontrada")
    })
    public ResponseEntity<ExhibicionAdminResponse> obtener(@PathVariable Long id) {
        Exhibicion exhibicion = exhibicionService.obtenerPorId(id);
        Map<String, ContenidoMultimedia> mm = exhibicionService.multimediaPorTipo(exhibicion.getId());
        String editor = exhibicion.getActualizadoPor() != null
                ? exhibicion.getActualizadoPor().getNombre() : null;
        return ResponseEntity.ok(DtoMapper.toExhibicionAdminResponse(
                exhibicion, editor, mm.get(ContenidoMultimedia.TIPO_IMAGEN), mm.get(ContenidoMultimedia.TIPO_VIDEO)));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Editar contenido de la exhibición",
            description = "Actualiza nombre, descripción corta (obligatorios), descripción completa, "
                    + "época, materiales, cultura o procedencia y dato curioso. Usa bloqueo optimista.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Exhibición actualizada"),
            @ApiResponse(responseCode = "400", description = "Solicitud inválida"),
            @ApiResponse(responseCode = "401", description = "No autenticado"),
            @ApiResponse(responseCode = "403", description = "Sin permisos o cambio de contraseña pendiente"),
            @ApiResponse(responseCode = "404", description = "Exhibición no encontrada"),
            @ApiResponse(responseCode = "409", description = "Versión obsoleta (edición concurrente)")
    })
    public ResponseEntity<ExhibicionAdminResponse> editar(
            @PathVariable Long id,
            @Valid @RequestBody EditarExhibicionRequest request,
            @AuthenticationPrincipal UsuarioAdminPrincipal principal) {
        Long usuarioId = principal != null ? principal.getId() : null;
        Exhibicion actualizada = exhibicionService.editar(id, request, usuarioId);
        return ResponseEntity.ok(detalle(actualizada));
    }

    @PatchMapping("/{id}/estado")
    @Operation(summary = "Activar o desactivar exhibición",
            description = "Activa o desactiva. No permite activar sin imagen (409).")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Estado actualizado"),
            @ApiResponse(responseCode = "401", description = "No autenticado"),
            @ApiResponse(responseCode = "403", description = "Sin permisos o cambio de contraseña pendiente"),
            @ApiResponse(responseCode = "404", description = "Exhibición no encontrada"),
            @ApiResponse(responseCode = "409", description = "No se puede activar sin imagen")
    })
    public ResponseEntity<ExhibicionAdminResponse> cambiarEstado(
            @PathVariable Long id,
            @Valid @RequestBody CambioEstadoRequest request,
            @AuthenticationPrincipal UsuarioAdminPrincipal principal) {
        Long usuarioId = principal != null ? principal.getId() : null;
        Exhibicion actualizada = exhibicionService.cambiarEstado(id, request, usuarioId);
        return ResponseEntity.ok(detalle(actualizada));
    }

    @PutMapping(value = "/{id}/imagen", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Subir o reemplazar la imagen",
            description = "JPG, PNG o WEBP, máximo 5 MB. La imagen no se puede eliminar, solo reemplazar.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Imagen subida o reemplazada"),
            @ApiResponse(responseCode = "400", description = "Archivo inválido o demasiado grande"),
            @ApiResponse(responseCode = "401", description = "No autenticado"),
            @ApiResponse(responseCode = "403", description = "Sin permisos o cambio de contraseña pendiente"),
            @ApiResponse(responseCode = "404", description = "Exhibición no encontrada")
    })
    public ResponseEntity<ExhibicionAdminResponse> subirImagen(
            @PathVariable Long id,
            @RequestPart("archivo") MultipartFile archivo,
            @AuthenticationPrincipal UsuarioAdminPrincipal principal) {
        Long usuarioId = principal != null ? principal.getId() : null;
        exhibicionService.subirImagen(id, archivo, usuarioId);
        return ResponseEntity.ok(detalle(exhibicionService.obtenerPorId(id)));
    }

    @PutMapping(value = "/{id}/video", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Subir o reemplazar el video",
            description = "MP4 o WEBM, máximo 50 MB.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Video subido o reemplazado"),
            @ApiResponse(responseCode = "400", description = "Archivo inválido o demasiado grande"),
            @ApiResponse(responseCode = "401", description = "No autenticado"),
            @ApiResponse(responseCode = "403", description = "Sin permisos o cambio de contraseña pendiente"),
            @ApiResponse(responseCode = "404", description = "Exhibición no encontrada")
    })
    public ResponseEntity<ExhibicionAdminResponse> subirVideo(
            @PathVariable Long id,
            @RequestPart("archivo") MultipartFile archivo,
            @AuthenticationPrincipal UsuarioAdminPrincipal principal) {
        Long usuarioId = principal != null ? principal.getId() : null;
        exhibicionService.subirVideo(id, archivo, usuarioId);
        return ResponseEntity.ok(detalle(exhibicionService.obtenerPorId(id)));
    }

    @DeleteMapping("/{id}/video")
    @Operation(summary = "Eliminar el video", description = "Elimina el video de la exhibición (opcional).")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Video eliminado"),
            @ApiResponse(responseCode = "401", description = "No autenticado"),
            @ApiResponse(responseCode = "403", description = "Sin permisos o cambio de contraseña pendiente"),
            @ApiResponse(responseCode = "404", description = "Exhibición no encontrada")
    })
    public ResponseEntity<Void> eliminarVideo(
            @PathVariable Long id,
            @AuthenticationPrincipal UsuarioAdminPrincipal principal) {
        Long usuarioId = principal != null ? principal.getId() : null;
        exhibicionService.eliminarVideo(id, usuarioId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/imagen")
    @Operation(summary = "Eliminar la imagen (no permitido)",
            description = "La imagen de una exhibición no se puede eliminar, solo reemplazar.")
    @ApiResponses({
            @ApiResponse(responseCode = "409", description = "La imagen no se puede eliminar"),
            @ApiResponse(responseCode = "401", description = "No autenticado"),
            @ApiResponse(responseCode = "403", description = "Sin permisos o cambio de contraseña pendiente")
    })
    public ResponseEntity<Void> eliminarImagen(@PathVariable Long id) {
        exhibicionService.eliminarImagenNoPermitido(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/historial")
    @Operation(summary = "Historial de una exhibición",
            description = "Ediciones, cambios de estado y multimedia, del más reciente al más antiguo.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Historial"),
            @ApiResponse(responseCode = "401", description = "No autenticado"),
            @ApiResponse(responseCode = "403", description = "Sin permisos o cambio de contraseña pendiente"),
            @ApiResponse(responseCode = "404", description = "Exhibición no encontrada")
    })
    public ResponseEntity<List<ExhibicionHistorialItem>> historial(@PathVariable Long id) {
        return ResponseEntity.ok(exhibicionService.historial(id));
    }

    private ExhibicionAdminResponse detalle(Exhibicion exhibicion) {
        Map<String, ContenidoMultimedia> mm = exhibicionService.multimediaPorTipo(exhibicion.getId());
        String editor = exhibicion.getActualizadoPor() != null
                ? exhibicion.getActualizadoPor().getNombre() : null;
        return DtoMapper.toExhibicionAdminResponse(
                exhibicion, editor, mm.get(ContenidoMultimedia.TIPO_IMAGEN), mm.get(ContenidoMultimedia.TIPO_VIDEO));
    }

    private ExhibicionAdminResponse aDto(Exhibicion exhibicion, Map<Long, String> nombres,
                                         Map<Long, Map<String, ContenidoMultimedia>> multimedia) {
        String editor = exhibicion.getActualizadoPor() != null
                ? nombres.get(exhibicion.getActualizadoPor().getId()) : null;
        Map<String, ContenidoMultimedia> mm = multimedia.getOrDefault(exhibicion.getId(), Map.of());
        return DtoMapper.toExhibicionAdminResponse(
                exhibicion, editor, mm.get(ContenidoMultimedia.TIPO_IMAGEN), mm.get(ContenidoMultimedia.TIPO_VIDEO));
    }
}
