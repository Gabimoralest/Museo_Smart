package com.museosmart.service;

import com.museosmart.entity.UsuarioAdmin;
import com.museosmart.exception.RecursoNoEncontradoException;
import com.museosmart.exception.ReglaNegocioException;
import com.museosmart.repository.UsuarioAdminRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

@Service
@Transactional(readOnly = true)
public class UsuarioAdminService {

    public static final String ROL_SUPERADMIN = "SUPERADMIN";
    public static final String ROL_ADMIN = "ADMIN";

    private static final Set<String> ROLES_VALIDOS = Set.of(ROL_SUPERADMIN, ROL_ADMIN);
    private static final Set<String> ESTADOS_VALIDOS = Set.of("ACTIVO", "INACTIVO", "BLOQUEADO");
    private static final String ESTADO_ACTIVO = "ACTIVO";

    private final UsuarioAdminRepository usuarioAdminRepository;
    private final PasswordEncoder passwordEncoder;

    public UsuarioAdminService(UsuarioAdminRepository usuarioAdminRepository, PasswordEncoder passwordEncoder) {
        this.usuarioAdminRepository = usuarioAdminRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public List<UsuarioAdmin> listarTodos() {
        return usuarioAdminRepository.findAll();
    }

    public UsuarioAdmin obtenerPorId(Long id) {
        return usuarioAdminRepository.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("No existe el administrador con id " + id));
    }

    @Transactional
    public UsuarioAdmin crear(String nombre, String correo, String rol, String contrasenaPlana) {
        validarTextoObligatorio(nombre, "El nombre es obligatorio");
        validarTextoObligatorio(correo, "El correo es obligatorio");
        validarRol(rol);
        validarTextoObligatorio(contrasenaPlana, "La contraseña es obligatoria");

        if (usuarioAdminRepository.existsByCorreoIgnoreCase(correo)) {
            throw new ReglaNegocioException("Ya existe un administrador con el correo " + correo);
        }

        UsuarioAdmin usuario = new UsuarioAdmin();
        usuario.setNombre(nombre);
        usuario.setCorreo(correo);
        usuario.setRol(rol);
        usuario.setEstado(ESTADO_ACTIVO);
        usuario.setPrimerInicioSesion(true);
        usuario.setHashContrasena(passwordEncoder.encode(contrasenaPlana));

        return usuarioAdminRepository.save(usuario);
    }

    @Transactional
    public UsuarioAdmin actualizar(Long id, String nombre, String correo) {
        validarTextoObligatorio(nombre, "El nombre es obligatorio");
        validarTextoObligatorio(correo, "El correo es obligatorio");

        UsuarioAdmin usuario = obtenerPorId(id);

        if (usuarioAdminRepository.findByCorreoIgnoreCase(correo)
                .filter(otro -> !otro.getId().equals(id))
                .isPresent()) {
            throw new ReglaNegocioException("Ya existe un administrador con el correo " + correo);
        }

        usuario.setNombre(nombre);
        usuario.setCorreo(correo);
        return usuarioAdminRepository.save(usuario);
    }

    @Transactional
    public UsuarioAdmin cambiarEstado(Long id, String nuevoEstado) {
        validarEstado(nuevoEstado);

        UsuarioAdmin usuario = obtenerPorId(id);

        if (ROL_SUPERADMIN.equals(usuario.getRol()) && requiereProteccionSuperAdmin(nuevoEstado)) {
            protegerUltimoSuperAdminActivo(id);
        }

        // Cualquier cambio de estado incrementa la version de seguridad: invalida
        // los JWT previos. Asi, reactivar una cuenta no rehabilita sesiones antiguas.
        if (!nuevoEstado.equals(usuario.getEstado())) {
            usuario.incrementarTokenVersion();
        }

        usuario.setEstado(nuevoEstado);
        return usuarioAdminRepository.save(usuario);
    }

    @Transactional
    public void eliminar(Long id) {
        UsuarioAdmin usuario = obtenerPorId(id);

        if (ROL_SUPERADMIN.equals(usuario.getRol()) && ESTADO_ACTIVO.equals(usuario.getEstado())) {
            protegerUltimoSuperAdminActivo(id);
        }

        usuarioAdminRepository.delete(usuario);
    }

    private boolean requiereProteccionSuperAdmin(String nuevoEstado) {
        return !ESTADO_ACTIVO.equals(nuevoEstado);
    }

    /**
     * Serializa las operaciones que pueden dejar el sistema sin SuperAdmin activo.
     *
     * Estrategia: se adquiere un bloqueo pesimista de escritura (SELECT ... FOR UPDATE)
     * sobre TODAS las filas de rol SUPERADMIN, ordenadas por id. Ordenar por id fija un
     * orden de adquisición determinista y evita deadlocks entre transacciones.
     *
     * Punto de sincronizacion: el conjunto de filas SUPERADMIN es el recurso compartido,
     * porque justamente ese conjunto determina cuantos SuperAdmin activos existen. Al
     * bloquearlo, una segunda transaccion que intente desactivar/eliminar otro SuperAdmin
     * espera hasta el fin de la primera, de modo que ya ve el estado actualizado y no puede
     * superar la comprobacion.
     *
     * Nota: si el registro objetivo no existe como SUPERADMIN (caso ya validado antes),
     * no se llega a este metodo.
     */
    private void protegerUltimoSuperAdminActivo(Long idObjetivo) {
        List<UsuarioAdmin> superAdmins = usuarioAdminRepository.findByRolForUpdate(ROL_SUPERADMIN);

        long activos = superAdmins.stream()
                .filter(u -> ESTADO_ACTIVO.equals(u.getEstado()))
                .count();

        if (activos <= 1 && superAdmins.stream().anyMatch(u -> u.getId().equals(idObjetivo))) {
            throw new ReglaNegocioException(
                    "No se puede desactivar, bloquear ni eliminar al último SuperAdmin activo");
        }
    }

    private void validarRol(String rol) {
        if (rol == null || !ROLES_VALIDOS.contains(rol)) {
            throw new ReglaNegocioException("Rol inválido: " + rol + ". Valores permitidos: " + ROLES_VALIDOS);
        }
    }

    private void validarEstado(String estado) {
        if (estado == null || !ESTADOS_VALIDOS.contains(estado)) {
            throw new ReglaNegocioException("Estado inválido: " + estado + ". Valores permitidos: " + ESTADOS_VALIDOS);
        }
    }

    private void validarTextoObligatorio(String valor, String mensaje) {
        if (valor == null || valor.isBlank()) {
            throw new ReglaNegocioException(mensaje);
        }
    }
}
