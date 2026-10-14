package com.museosmart.security;

import com.museosmart.dto.CambioContrasenaRequest;
import com.museosmart.entity.UsuarioAdmin;
import com.museosmart.repository.UsuarioAdminRepository;
import com.museosmart.service.AuthService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Prueba de INTEGRACION REAL con PostgreSQL usando una base AISLADA
 * (museo_smart_test), nunca la base de desarrollo compartida.
 *
 * Solo se ejecuta cuando RUN_DB_IT=true. Los tests son @Transactional, por lo
 * que todos los datos creados se revierten al terminar (no se altera ningun
 * dato). Verifica el comportamiento real de persistencia de token_version y del
 * filtro de revocacion contra la base de datos.
 */
@SpringBootTest
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "RUN_DB_IT", matches = "true")
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:postgresql://localhost:5432/museo_smart_test",
        "spring.datasource.username=postgres",
        "spring.datasource.password=${DB_PASSWORD:}",
        "spring.jpa.hibernate.ddl-auto=validate",
        "spring.flyway.enabled=true",
        "app.mail.habilitado=false",
        "app.security.jwt.secret=clave-de-prueba-integracion-suficientemente-larga-1234567890"
})
@Transactional
class TokenRevocationIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UsuarioAdminRepository usuarioAdminRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private AuthService authService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private UsuarioAdmin crearSuperAdmin(String contrasenaPlana) {
        UsuarioAdmin u = new UsuarioAdmin();
        u.setNombre("IT " + UUID.randomUUID());
        u.setCorreo("it-" + UUID.randomUUID() + "@museo.com");
        u.setRol("SUPERADMIN");
        u.setEstado("ACTIVO");
        u.setPrimerInicioSesion(false);
        u.setTokenVersion(0);
        u.setHashContrasena(passwordEncoder.encode(contrasenaPlana));
        return usuarioAdminRepository.save(u);
    }

    private String bearer(UsuarioAdmin u) {
        return "Bearer " + jwtService.generarToken(u);
    }

    @Test
    @DisplayName("usuario ACTIVO con tv coincidente accede (200) contra PostgreSQL real")
    void activo_accede() throws Exception {
        UsuarioAdmin u = crearSuperAdmin("Secreta123");

        mockMvc.perform(get("/api/v1/admin/usuarios").header("Authorization", bearer(u)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("desactivar la cuenta en BD invalida el token existente (401)")
    void desactivar_invalidaToken() throws Exception {
        UsuarioAdmin u = crearSuperAdmin("Secreta123");
        String token = bearer(u);

        u.setEstado("INACTIVO");
        usuarioAdminRepository.save(u);
        usuarioAdminRepository.flush();

        mockMvc.perform(get("/api/v1/admin/usuarios").header("Authorization", token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("cambiar la contraseña incrementa token_version y rechaza el token previo (401)")
    void cambiarContrasena_revocaToken() throws Exception {
        UsuarioAdmin u = crearSuperAdmin("Secreta123");
        String tokenViejo = bearer(u);

        authService.cambiarContrasena(u.getCorreo(), new CambioContrasenaRequest("Secreta123", "NuevaClave456"));
        usuarioAdminRepository.flush();

        // El token previo (tv=0) ya no coincide con token_version (1).
        mockMvc.perform(get("/api/v1/admin/usuarios").header("Authorization", tokenViejo))
                .andExpect(status().isUnauthorized());

        // Un token emitido con la nueva versión sí funciona.
        UsuarioAdmin recargado = usuarioAdminRepository.findById(u.getId()).orElseThrow();
        mockMvc.perform(get("/api/v1/admin/usuarios").header("Authorization", bearer(recargado)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("reactivar la cuenta no rehabilita el token antiguo (401)")
    void reactivar_noRehabilitaToken() throws Exception {
        UsuarioAdmin u = crearSuperAdmin("Secreta123");
        String tokenViejo = bearer(u);

        u.setEstado("INACTIVO");
        u.setTokenVersion(u.getTokenVersion() + 1);
        usuarioAdminRepository.save(u);

        u.setEstado("ACTIVO");
        u.setTokenVersion(u.getTokenVersion() + 1);
        usuarioAdminRepository.save(u);
        usuarioAdminRepository.flush();

        mockMvc.perform(get("/api/v1/admin/usuarios").header("Authorization", tokenViejo))
                .andExpect(status().isUnauthorized());
    }
}
