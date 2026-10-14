package com.museosmart.config;

import com.museosmart.entity.UsuarioAdmin;
import com.museosmart.repository.UsuarioAdminRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.ApplicationArguments;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Inicializacion controlada del primer SuperAdmin.
 *
 * Reglas de seguridad:
 * - Solo actua si se definen MUSEO_SUPERADMIN_EMAIL y MUSEO_SUPERADMIN_PASSWORD.
 * - Solo crea la cuenta si NO existe ningun usuario administrador (tabla vacia).
 * - La contrasena se codifica con BCrypt; nunca se registra en logs ni en SQL.
 * - No hay valores por defecto: sin variables, no se crea ninguna cuenta.
 */
@Component
public class SuperAdminInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SuperAdminInitializer.class);
    private static final int MIN_PASSWORD = 8;

    private final UsuarioAdminRepository usuarioAdminRepository;
    private final PasswordEncoder passwordEncoder;
    private final String email;
    private final String password;
    private final String nombre;

    public SuperAdminInitializer(UsuarioAdminRepository usuarioAdminRepository,
                                 PasswordEncoder passwordEncoder,
                                 @Value("${app.bootstrap.superadmin.email:}") String email,
                                 @Value("${app.bootstrap.superadmin.password:}") String password,
                                 @Value("${app.bootstrap.superadmin.nombre:SuperAdministrador}") String nombre) {
        this.usuarioAdminRepository = usuarioAdminRepository;
        this.passwordEncoder = passwordEncoder;
        this.email = email;
        this.password = password;
        this.nombre = nombre;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        boolean sinEmail = email == null || email.isBlank();
        boolean sinPassword = password == null || password.isBlank();

        if (sinEmail || sinPassword) {
            log.info("Bootstrap de SuperAdmin omitido: variables MUSEO_SUPERADMIN_EMAIL/PASSWORD no configuradas.");
            return;
        }
        if (password.length() < MIN_PASSWORD) {
            log.warn("Bootstrap de SuperAdmin omitido: la contrasena configurada no cumple el mínimo de {} caracteres.",
                    MIN_PASSWORD);
            return;
        }
        if (usuarioAdminRepository.count() > 0) {
            log.info("Bootstrap de SuperAdmin omitido: ya existen usuarios administradores.");
            return;
        }

        UsuarioAdmin superAdmin = new UsuarioAdmin();
        superAdmin.setNombre(nombre);
        superAdmin.setCorreo(email);
        superAdmin.setRol("SUPERADMIN");
        superAdmin.setEstado("ACTIVO");
        superAdmin.setPrimerInicioSesion(true);
        superAdmin.setHashContrasena(passwordEncoder.encode(password));
        usuarioAdminRepository.save(superAdmin);

        log.info("SuperAdmin inicial provisionado para {}. Debe cambiar la contraseña en el primer inicio de sesión.",
                email);
    }
}
