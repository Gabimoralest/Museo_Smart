package com.museosmart.security;

import com.museosmart.entity.UsuarioAdmin;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private static final String SECRET = "clave-de-prueba-suficientemente-larga-1234567890";

    private JwtService jwtService(long expiracion) {
        return new JwtService(SECRET, expiracion);
    }

    @Test
    @DisplayName("genera y valida un token con los claims del usuario")
    void generarYValidar() {
        JwtService service = jwtService(60);
        UsuarioAdmin usuario = usuario(7L, "admin@museo.com", "ADMIN", "ACTIVO", false);

        String token = service.generarToken(usuario);
        Claims claims = service.parsear(token);

        assertThat(claims.getSubject()).isEqualTo("admin@museo.com");
        assertThat(claims.get(JwtService.CLAIM_ROL, String.class)).isEqualTo("ADMIN");
        assertThat(claims.get(JwtService.CLAIM_ID, Number.class).longValue()).isEqualTo(7L);
        assertThat(claims.get(JwtService.CLAIM_PRIMER_INICIO, Boolean.class)).isFalse();
        assertThat(claims.get(JwtService.CLAIM_TOKEN_VERSION, Integer.class)).isEqualTo(0);
    }

    @Test
    @DisplayName("un token firmado con otro secreto es rechazado")
    void tokenConOtraFirmaRechazado() {
        JwtService emisor = new JwtService("otro-secreto-distinto-suficientemente-largo-000", 60);
        JwtService validador = jwtService(60);
        String token = emisor.generarToken(usuario(1L, "a@museo.com", "ADMIN", "ACTIVO", false));

        assertThatThrownBy(() -> validador.parsear(token))
                .isInstanceOf(JwtException.class);
    }

    @Test
    @DisplayName("un token expirado es rechazado")
    void tokenExpiradoRechazado() {
        // Expiracion negativa -> ya vencido en el momento de emitir.
        JwtService emisor = new JwtService(SECRET, -1);
        String token = emisor.generarToken(usuario(1L, "a@museo.com", "ADMIN", "ACTIVO", false));

        assertThatThrownBy(() -> jwtService(60).parsear(token))
                .isInstanceOf(JwtException.class);
    }

    @Test
    @DisplayName("un secreto demasiado corto es rechazado al construir el servicio")
    void secretoCortoRechazado() {
        assertThatThrownBy(() -> new JwtService("corto", 60))
                .isInstanceOf(IllegalStateException.class);
    }

    private UsuarioAdmin usuario(Long id, String correo, String rol, String estado, boolean primerInicio) {
        UsuarioAdmin u = new UsuarioAdmin();
        setField(u, "id", id);
        u.setNombre("Nombre");
        u.setCorreo(correo);
        u.setRol(rol);
        u.setEstado(estado);
        u.setPrimerInicioSesion(primerInicio);
        return u;
    }

    private void setField(Object target, String campo, Object valor) {
        try {
            java.lang.reflect.Field field = target.getClass().getDeclaredField(campo);
            field.setAccessible(true);
            field.set(target, valor);
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
