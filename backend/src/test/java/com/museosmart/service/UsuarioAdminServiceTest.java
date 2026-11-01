package com.museosmart.service;

import com.museosmart.entity.UsuarioAdmin;
import com.museosmart.exception.OperacionProhibidaException;
import com.museosmart.exception.RecursoNoEncontradoException;
import com.museosmart.exception.ReglaNegocioException;
import com.museosmart.repository.UsuarioAdminRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UsuarioAdminServiceTest {

    @Mock
    private UsuarioAdminRepository usuarioAdminRepository;

    @Spy
    private PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @InjectMocks
    private UsuarioAdminService usuarioAdminService;

    // ---------- Consultas ----------

    @Test
    @DisplayName("listarTodos devuelve todos los administradores del repositorio")
    void listarTodos_devuelveTodos() {
        List<UsuarioAdmin> esperados = List.of(admin(1L, "SUPERADMIN", "ACTIVO"),
                admin(2L, "ADMIN", "ACTIVO"));
        when(usuarioAdminRepository.findAll()).thenReturn(esperados);

        List<UsuarioAdmin> resultado = usuarioAdminService.listarTodos();

        assertThat(resultado).isEqualTo(esperados);
        verify(usuarioAdminRepository).findAll();
    }

    @Test
    @DisplayName("crear usa el PasswordEncoder inyectado, no una instancia interna")
    void crear_usaEncoderInyectado() {
        when(usuarioAdminRepository.existsByCorreoIgnoreCase("iny@museo.com")).thenReturn(false);
        when(usuarioAdminRepository.save(any(UsuarioAdmin.class))).thenAnswer(inv -> inv.getArgument(0));

        usuarioAdminService.crear("Inyectado", "iny@museo.com", "Secreta123");

        verify(passwordEncoder).encode("Secreta123");
    }

    @Test
    @DisplayName("obtenerPorId devuelve el administrador cuando existe")
    void obtenerPorId_devuelveCuandoExiste() {
        UsuarioAdmin esperado = admin(5L, "ADMIN", "ACTIVO");
        when(usuarioAdminRepository.findById(5L)).thenReturn(Optional.of(esperado));

        UsuarioAdmin resultado = usuarioAdminService.obtenerPorId(5L);

        assertThat(resultado).isSameAs(esperado);
    }

    @Test
    @DisplayName("obtenerPorId lanza RecursoNoEncontradoException cuando no existe")
    void obtenerPorId_lanzaCuandoNoExiste() {
        when(usuarioAdminRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> usuarioAdminService.obtenerPorId(99L))
                .isInstanceOf(RecursoNoEncontradoException.class)
                .hasMessageContaining("99");
    }

    // ---------- Crear ----------

    @Test
    @DisplayName("crear guarda el administrador con la contraseña hasheada (nunca en texto plano)")
    void crear_hasheaLaContrasena() {
        when(usuarioAdminRepository.existsByCorreoIgnoreCase("nuevo@museo.com")).thenReturn(false);
        when(usuarioAdminRepository.save(any(UsuarioAdmin.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        usuarioAdminService.crear("Nuevo Admin", "nuevo@museo.com", "Secreta123");

        ArgumentCaptor<UsuarioAdmin> captor = ArgumentCaptor.forClass(UsuarioAdmin.class);
        verify(usuarioAdminRepository).save(captor.capture());
        UsuarioAdmin guardado = captor.getValue();

        assertThat(guardado.getHashContrasena()).isNotNull();
        assertThat(guardado.getHashContrasena()).isNotEqualTo("Secreta123");
        assertThat(passwordEncoder.matches("Secreta123", guardado.getHashContrasena())).isTrue();
        assertThat(guardado.getEstado()).isEqualTo("ACTIVO");
        assertThat(guardado.isPrimerInicioSesion()).isTrue();
    }

    @Test
    @DisplayName("crear rechaza un correo duplicado y no guarda")
    void crear_rechazaCorreoDuplicado() {
        when(usuarioAdminRepository.existsByCorreoIgnoreCase("dup@museo.com")).thenReturn(true);

        assertThatThrownBy(() -> usuarioAdminService.crear("Dup", "dup@museo.com", "Secreta123"))
                .isInstanceOf(ReglaNegocioException.class)
                .hasMessageContaining("dup@museo.com");

        verify(usuarioAdminRepository, never()).save(any(UsuarioAdmin.class));
    }

    @Test
    @DisplayName("crear rechaza un correo duplicado ignorando mayúsculas")
    void crear_rechazaCorreoDuplicadoIgnorandoMayusculas() {
        when(usuarioAdminRepository.existsByCorreoIgnoreCase("ADMIN@MUSEO.COM")).thenReturn(true);

        assertThatThrownBy(() -> usuarioAdminService.crear("Dup", "ADMIN@MUSEO.COM", "Secreta123"))
                .isInstanceOf(ReglaNegocioException.class);

        verify(usuarioAdminRepository, never()).save(any(UsuarioAdmin.class));
    }

    @Test
    @DisplayName("crear acepta el correo cuando no existe duplicado")
    void crear_aceptaCorreoNoDuplicado() {
        when(usuarioAdminRepository.existsByCorreoIgnoreCase("libre@museo.com")).thenReturn(false);
        when(usuarioAdminRepository.save(any(UsuarioAdmin.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        UsuarioAdmin resultado = usuarioAdminService.crear("Libre", "libre@museo.com", "Secreta123");

        assertThat(resultado.getCorreo()).isEqualTo("libre@museo.com");
    }

    @Test
    @DisplayName("crear siempre crea la cuenta con rol ADMIN")
    void crear_siempreEsAdmin() {
        when(usuarioAdminRepository.existsByCorreoIgnoreCase("nuevo@museo.com")).thenReturn(false);
        when(usuarioAdminRepository.save(any(UsuarioAdmin.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        UsuarioAdmin resultado = usuarioAdminService.crear("Nuevo", "nuevo@museo.com", "Secreta123");

        assertThat(resultado.getRol()).isEqualTo("ADMIN");
    }

    @Test
    @DisplayName("validarRolNoEscalable acepta vacio y ADMIN")
    void validarRol_aceptaAdminYVacio() {
        usuarioAdminService.validarRolNoEscalable(null);
        usuarioAdminService.validarRolNoEscalable("");
        usuarioAdminService.validarRolNoEscalable("  ");
        usuarioAdminService.validarRolNoEscalable("ADMIN");
        usuarioAdminService.validarRolNoEscalable("admin");
    }

    @Test
    @DisplayName("validarRolNoEscalable rechaza SUPERADMIN y otros roles")
    void validarRol_rechazaSuperAdminYOtros() {
        assertThatThrownBy(() -> usuarioAdminService.validarRolNoEscalable("SUPERADMIN"))
                .isInstanceOf(ReglaNegocioException.class)
                .hasMessageContaining("siempre ADMIN");
        assertThatThrownBy(() -> usuarioAdminService.validarRolNoEscalable("GUIA"))
                .isInstanceOf(ReglaNegocioException.class);

        verifyNoInteractions(usuarioAdminRepository);
    }

    @Test
    @DisplayName("crear rechaza campos obligatorios vacios o nulos")
    void crear_rechazaCamposObligatoriosVacios() {
        assertThatThrownBy(() -> usuarioAdminService.crear("  ", "x@museo.com", "Secreta123"))
                .isInstanceOf(ReglaNegocioException.class);
        assertThatThrownBy(() -> usuarioAdminService.crear("X", null, "Secreta123"))
                .isInstanceOf(ReglaNegocioException.class);
        assertThatThrownBy(() -> usuarioAdminService.crear("X", "x@museo.com", ""))
                .isInstanceOf(ReglaNegocioException.class);

        verifyNoInteractions(usuarioAdminRepository);
    }

    // ---------- Actualizar ----------

    @Test
    @DisplayName("actualizar cambia nombre y correo sin tocar el hash de la contraseña")
    void actualizar_noModificaHash() {
        UsuarioAdmin existente = admin(3L, "ADMIN", "ACTIVO");
        existente.setHashContrasena("$2a$hash-original-intacto");
        when(usuarioAdminRepository.findById(3L)).thenReturn(Optional.of(existente));
        when(usuarioAdminRepository.findByCorreoIgnoreCase("nuevo@museo.com")).thenReturn(Optional.empty());
        when(usuarioAdminRepository.save(any(UsuarioAdmin.class))).thenAnswer(inv -> inv.getArgument(0));

        UsuarioAdmin resultado = usuarioAdminService.actualizar(3L, "Nombre Nuevo", "nuevo@museo.com");

        assertThat(resultado.getNombre()).isEqualTo("Nombre Nuevo");
        assertThat(resultado.getCorreo()).isEqualTo("nuevo@museo.com");
        assertThat(resultado.getHashContrasena()).isEqualTo("$2a$hash-original-intacto");
    }

    @Test
    @DisplayName("actualizar permite conservar el mismo correo del propio administrador")
    void actualizar_permiteMismoCorreoPropio() {
        UsuarioAdmin existente = admin(3L, "ADMIN", "ACTIVO");
        when(usuarioAdminRepository.findById(3L)).thenReturn(Optional.of(existente));
        when(usuarioAdminRepository.findByCorreoIgnoreCase("mio@museo.com")).thenReturn(Optional.of(existente));
        when(usuarioAdminRepository.save(any(UsuarioAdmin.class))).thenAnswer(inv -> inv.getArgument(0));

        UsuarioAdmin resultado = usuarioAdminService.actualizar(3L, "Yo", "mio@museo.com");

        assertThat(resultado.getCorreo()).isEqualTo("mio@museo.com");
    }

    @Test
    @DisplayName("actualizar rechaza un correo ya usado por otro administrador")
    void actualizar_rechazaCorreoDeOtro() {
        UsuarioAdmin existente = admin(3L, "ADMIN", "ACTIVO");
        UsuarioAdmin otro = admin(4L, "ADMIN", "ACTIVO");
        when(usuarioAdminRepository.findById(3L)).thenReturn(Optional.of(existente));
        when(usuarioAdminRepository.findByCorreoIgnoreCase("ocupado@museo.com")).thenReturn(Optional.of(otro));

        assertThatThrownBy(() -> usuarioAdminService.actualizar(3L, "Yo", "ocupado@museo.com"))
                .isInstanceOf(ReglaNegocioException.class)
                .hasMessageContaining("ocupado@museo.com");

        verify(usuarioAdminRepository, never()).save(any(UsuarioAdmin.class));
    }

    @Test
    @DisplayName("actualizar un SUPERADMIN devuelve OperacionProhibidaException (403)")
    void actualizar_superAdminProhibido() {
        UsuarioAdmin superAdmin = admin(1L, "SUPERADMIN", "ACTIVO");
        when(usuarioAdminRepository.findById(1L)).thenReturn(Optional.of(superAdmin));

        assertThatThrownBy(() -> usuarioAdminService.actualizar(1L, "Otro", "otro@museo.com"))
                .isInstanceOf(OperacionProhibidaException.class)
                .hasMessageContaining("SuperAdmin no se puede modificar desde el panel");

        verify(usuarioAdminRepository, never()).save(any(UsuarioAdmin.class));
    }

    @Test
    @DisplayName("actualizar lanza RecursoNoEncontradoException si el administrador no existe")
    void actualizar_lanzaCuandoNoExiste() {
        when(usuarioAdminRepository.findById(77L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> usuarioAdminService.actualizar(77L, "Yo", "yo@museo.com"))
                .isInstanceOf(RecursoNoEncontradoException.class);
    }

    // ---------- Cambiar estado ----------

    @Test
    @DisplayName("cambiarEstado acepta un estado válido para un administrador no SuperAdmin")
    void cambiarEstado_aceptaEstadoValido() {
        UsuarioAdmin existente = admin(6L, "ADMIN", "ACTIVO");
        when(usuarioAdminRepository.findById(6L)).thenReturn(Optional.of(existente));
        when(usuarioAdminRepository.save(any(UsuarioAdmin.class))).thenAnswer(inv -> inv.getArgument(0));

        UsuarioAdmin resultado = usuarioAdminService.cambiarEstado(6L, "BLOQUEADO");

        assertThat(resultado.getEstado()).isEqualTo("BLOQUEADO");
        assertThat(resultado.getTokenVersion()).isEqualTo(1);
    }

    @Test
    @DisplayName("reactivar una cuenta incrementa la versión para invalidar sesiones previas")
    void cambiarEstado_reactivarIncrementaVersion() {
        UsuarioAdmin existente = admin(7L, "ADMIN", "INACTIVO");
        existente.setTokenVersion(2);
        when(usuarioAdminRepository.findById(7L)).thenReturn(Optional.of(existente));
        when(usuarioAdminRepository.save(any(UsuarioAdmin.class))).thenAnswer(inv -> inv.getArgument(0));

        UsuarioAdmin resultado = usuarioAdminService.cambiarEstado(7L, "ACTIVO");

        assertThat(resultado.getEstado()).isEqualTo("ACTIVO");
        assertThat(resultado.getTokenVersion()).isEqualTo(3);
    }

    @Test
    @DisplayName("cambiar al mismo estado no incrementa la versión")
    void cambiarEstado_mismoEstadoNoIncrementa() {
        UsuarioAdmin existente = admin(8L, "ADMIN", "ACTIVO");
        existente.setTokenVersion(4);
        when(usuarioAdminRepository.findById(8L)).thenReturn(Optional.of(existente));
        when(usuarioAdminRepository.save(any(UsuarioAdmin.class))).thenAnswer(inv -> inv.getArgument(0));

        UsuarioAdmin resultado = usuarioAdminService.cambiarEstado(8L, "ACTIVO");

        assertThat(resultado.getTokenVersion()).isEqualTo(4);
    }

    @Test
    @DisplayName("cambiarEstado rechaza un estado inválido sin consultar el repositorio")
    void cambiarEstado_rechazaEstadoInvalido() {
        assertThatThrownBy(() -> usuarioAdminService.cambiarEstado(6L, "SUSPENDIDO"))
                .isInstanceOf(ReglaNegocioException.class)
                .hasMessageContaining("Estado inválido");

        verifyNoInteractions(usuarioAdminRepository);
    }

    @Test
    @DisplayName("cambiarEstado sobre un SUPERADMIN devuelve OperacionProhibidaException (403)")
    void cambiarEstado_superAdminProhibido() {
        UsuarioAdmin superAdmin = admin(1L, "SUPERADMIN", "ACTIVO");
        when(usuarioAdminRepository.findById(1L)).thenReturn(Optional.of(superAdmin));

        assertThatThrownBy(() -> usuarioAdminService.cambiarEstado(1L, "INACTIVO"))
                .isInstanceOf(OperacionProhibidaException.class)
                .hasMessageContaining("SuperAdmin no se puede modificar desde el panel");

        verify(usuarioAdminRepository, never()).save(any(UsuarioAdmin.class));
    }

    // ---------- Eliminar ----------

    @Test
    @DisplayName("eliminar borra un administrador normal (ADMIN)")
    void eliminar_borraAdminNormal() {
        UsuarioAdmin adminNormal = admin(8L, "ADMIN", "ACTIVO");
        when(usuarioAdminRepository.findById(8L)).thenReturn(Optional.of(adminNormal));

        usuarioAdminService.eliminar(8L);

        verify(usuarioAdminRepository).delete(adminNormal);
    }

    @Test
    @DisplayName("eliminar un SUPERADMIN devuelve OperacionProhibidaException (403)")
    void eliminar_superAdminProhibido() {
        UsuarioAdmin superAdmin = admin(1L, "SUPERADMIN", "ACTIVO");
        when(usuarioAdminRepository.findById(1L)).thenReturn(Optional.of(superAdmin));

        assertThatThrownBy(() -> usuarioAdminService.eliminar(1L))
                .isInstanceOf(OperacionProhibidaException.class)
                .hasMessageContaining("SuperAdmin no se puede modificar desde el panel");

        verify(usuarioAdminRepository, never()).delete(any(UsuarioAdmin.class));
    }

    @Test
    @DisplayName("eliminar lanza RecursoNoEncontradoException si no existe")
    void eliminar_lanzaCuandoNoExiste() {
        when(usuarioAdminRepository.findById(55L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> usuarioAdminService.eliminar(55L))
                .isInstanceOf(RecursoNoEncontradoException.class);
    }
    private UsuarioAdmin admin(Long id, String rol, String estado) {
        UsuarioAdmin u = new UsuarioAdmin();
        setField(u, "id", id);
        u.setNombre("Admin " + id);
        u.setCorreo("admin" + id + "@museo.com");
        u.setRol(rol);
        u.setEstado(estado);
        return u;
    }

    private void setField(UsuarioAdmin usuario, String campo, Object valor) {
        try {
            java.lang.reflect.Field field = UsuarioAdmin.class.getDeclaredField(campo);
            field.setAccessible(true);
            field.set(usuario, valor);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException("No se pudo asignar el campo de prueba " + campo, e);
        }
    }
}
