package com.museosmart.service;

import com.museosmart.entity.UsuarioAdmin;
import com.museosmart.exception.OperacionProhibidaException;
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

    /** Mensaje unico para cualquier intento de modificar la cuenta SuperAdmin. */
    public static final String MENSAJE_SUPERADMIN_PROTEGIDO =
            "La cuenta de SuperAdmin no se puede modificar desde el panel";

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
    public UsuarioAdmin crear(String nombre, String correo, String contrasenaPlana) {
        validarTextoObligatorio(nombre, "El nombre es obligatorio");
        validarTextoObligatorio(correo, "El correo es obligatorio");
        validarTextoObligatorio(contrasenaPlana, "La contraseña es obligatoria");

        if (usuarioAdminRepository.existsByCorreoIgnoreCase(correo)) {
            throw new ReglaNegocioException("Ya existe un administrador con el correo " + correo);
        }

        UsuarioAdmin usuario = new UsuarioAdmin();
        usuario.setNombre(nombre);
        usuario.setCorreo(correo);
        // Las cuentas creadas desde el panel son SIEMPRE ADMIN. El SUPERADMIN
        // unico se provisiona desde el backend (SuperAdminInitializer).
        usuario.setRol(ROL_ADMIN);
        usuario.setEstado(ESTADO_ACTIVO);
        usuario.setPrimerInicioSesion(true);
        usuario.setHashContrasena(passwordEncoder.encode(contrasenaPlana));

        return usuarioAdminRepository.save(usuario);
    }

    /**
     * Rechaza un rol distinto de ADMIN (p. ej. {@code SUPERADMIN}) enviado en la
     * peticion. El rol no se persiste: solo actua como salvaguarda.
     *
     * @throws ReglaNegocioException (400) si el rol no es null/vacio ni ADMIN.
     */
    public void validarRolNoEscalable(String rol) {
        if (rol == null || rol.isBlank()) {
            return;
        }
        if (!ROL_ADMIN.equals(rol.trim().toUpperCase())) {
            throw new ReglaNegocioException(
                    "No se puede crear ni asignar el rol " + rol + ": las cuentas del panel son siempre ADMIN");
        }
    }

    @Transactional
    public UsuarioAdmin actualizar(Long id, String nombre, String correo) {
        validarTextoObligatorio(nombre, "El nombre es obligatorio");
        validarTextoObligatorio(correo, "El correo es obligatorio");

        UsuarioAdmin usuario = obtenerPorId(id);
        prohibirSuperAdmin(usuario);

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
        prohibirSuperAdmin(usuario);

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
        prohibirSuperAdmin(usuario);

        usuarioAdminRepository.delete(usuario);
    }

    /**
     * La cuenta SuperAdmin no se edita, desactiva ni elimina desde el panel.
     * Solo el SUPERADMIN puede cambiar su propia contrasena por el flujo normal.
     */
    private void prohibirSuperAdmin(UsuarioAdmin usuario) {
        if (ROL_SUPERADMIN.equals(usuario.getRol())) {
            throw new OperacionProhibidaException(MENSAJE_SUPERADMIN_PROTEGIDO);
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
