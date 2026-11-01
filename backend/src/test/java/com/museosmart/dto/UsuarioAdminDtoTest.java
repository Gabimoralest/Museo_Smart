package com.museosmart.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class UsuarioAdminDtoTest {

    private static ValidatorFactory factory;
    private static Validator validator;
    private static ObjectMapper objectMapper;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
        objectMapper = new ObjectMapper();
        objectMapper.findAndRegisterModules();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    private UsuarioAdminRequest requestValido() {
        return new UsuarioAdminRequest("Gabs", "admin@museo.com", "Secreta123", null);
    }

    // ---------- Validación al crear ----------

    @Test
    @DisplayName("al crear, una petición válida no produce violaciones")
    void crear_valido() {
        Set<ConstraintViolation<UsuarioAdminRequest>> violaciones =
                validator.validate(requestValido(), UsuarioAdminRequest.OnCreate.class);

        assertThat(violaciones).isEmpty();
    }

    @Test
    @DisplayName("al crear, el nombre es obligatorio")
    void crear_nombreObligatorio() {
        UsuarioAdminRequest req = new UsuarioAdminRequest("  ", "a@museo.com", "Secreta123", null);

        Set<ConstraintViolation<UsuarioAdminRequest>> violaciones =
                validator.validate(req, UsuarioAdminRequest.OnCreate.class);

        assertThat(violaciones).anyMatch(v -> v.getPropertyPath().toString().equals("nombre"));
    }

    @Test
    @DisplayName("al crear, el correo es obligatorio")
    void crear_correoObligatorio() {
        UsuarioAdminRequest req = new UsuarioAdminRequest("Gabs", "", "Secreta123", null);

        Set<ConstraintViolation<UsuarioAdminRequest>> violaciones =
                validator.validate(req, UsuarioAdminRequest.OnCreate.class);

        assertThat(violaciones).anyMatch(v -> v.getPropertyPath().toString().equals("correo"));
    }

    @Test
    @DisplayName("al crear, un correo con formato inválido es rechazado")
    void crear_correoInvalido() {
        UsuarioAdminRequest req = new UsuarioAdminRequest("Gabs", "no-es-un-correo", "Secreta123", null);

        Set<ConstraintViolation<UsuarioAdminRequest>> violaciones =
                validator.validate(req, UsuarioAdminRequest.OnCreate.class);

        assertThat(violaciones).anyMatch(v -> v.getPropertyPath().toString().equals("correo"));
    }

    @Test
    @DisplayName("al crear, un nombre mayor a 120 caracteres es rechazado")
    void crear_nombreDemasiadoLargo() {
        String largo = "x".repeat(121);
        UsuarioAdminRequest req = new UsuarioAdminRequest(largo, "a@museo.com", "Secreta123", null);

        Set<ConstraintViolation<UsuarioAdminRequest>> violaciones =
                validator.validate(req, UsuarioAdminRequest.OnCreate.class);

        assertThat(violaciones).anyMatch(v -> v.getPropertyPath().toString().equals("nombre"));
    }

    @Test
    @DisplayName("al crear, una contraseña de menos de 8 caracteres es rechazada")
    void crear_contrasenaCorta() {
        UsuarioAdminRequest req = new UsuarioAdminRequest("Gabs", "a@museo.com", "corta12", null);

        Set<ConstraintViolation<UsuarioAdminRequest>> violaciones =
                validator.validate(req, UsuarioAdminRequest.OnCreate.class);

        assertThat(violaciones).anyMatch(v -> v.getPropertyPath().toString().equals("contrasena"));
    }

    @Test
    @DisplayName("al crear, la contraseña es obligatoria")
    void crear_contrasenaObligatoria() {
        UsuarioAdminRequest req = new UsuarioAdminRequest("Gabs", "a@museo.com", null, null);

        Set<ConstraintViolation<UsuarioAdminRequest>> violaciones =
                validator.validate(req, UsuarioAdminRequest.OnCreate.class);

        assertThat(violaciones).anyMatch(v -> v.getPropertyPath().toString().equals("contrasena"));
    }

    @Test
    @DisplayName("el rol ya no es obligatorio ni se valida en el DTO (lo controla el servicio)")
    void crear_rolNoValidadoEnDto() {
        UsuarioAdminRequest sinRol = new UsuarioAdminRequest("Gabs", "a@museo.com", "Secreta123", null);

        Set<ConstraintViolation<UsuarioAdminRequest>> violaciones =
                validator.validate(sinRol, UsuarioAdminRequest.OnCreate.class);

        assertThat(violaciones).isEmpty();
    }
    // ---------- Validación al actualizar ----------

    @Test
    @DisplayName("al actualizar, no se exige contraseña")
    void actualizar_sinContrasena() {
        UsuarioAdminRequest req = new UsuarioAdminRequest("Gabs", "a@museo.com", null, null);

        Set<ConstraintViolation<UsuarioAdminRequest>> violaciones =
                validator.validate(req, UsuarioAdminRequest.OnUpdate.class);

        assertThat(violaciones).isEmpty();
    }

    @Test
    @DisplayName("al actualizar, el nombre y el correo siguen siendo obligatorios")
    void actualizar_camposObligatorios() {
        UsuarioAdminRequest req = new UsuarioAdminRequest("", "mal-correo", null, null);

        Set<ConstraintViolation<UsuarioAdminRequest>> violaciones =
                validator.validate(req, UsuarioAdminRequest.OnUpdate.class);

        assertThat(violaciones)
                .anyMatch(v -> v.getPropertyPath().toString().equals("nombre"))
                .anyMatch(v -> v.getPropertyPath().toString().equals("correo"));
    }

    // ---------- Respuesta / serialización ----------

    @Test
    @DisplayName("la respuesta NO expone hashContrasena en el JSON")
    void respuesta_sinHashContrasena() throws Exception {
        UsuarioAdminResponse response = new UsuarioAdminResponse(
                1L, "Gabs", "admin@museo.com", "ADMIN", "ACTIVO", false,
                null, OffsetDateTime.now(), OffsetDateTime.now());

        String json = objectMapper.writeValueAsString(response);

        assertThat(json).doesNotContain("hashContrasena");
        assertThat(json).doesNotContain("hash");
        assertThat(json).doesNotContain("contrasena");
        assertThat(json).contains("\"correo\":\"admin@museo.com\"");
        assertThat(json).contains("\"rol\":\"ADMIN\"");
    }

    @Test
    @DisplayName("el mapeo copia correctamente los campos del administrador")
    void mapeo_copiaCampos() {
        UsuarioAdminComprobado usuario = new UsuarioAdminComprobado();

        UsuarioAdminResponse response = DtoMapper.toUsuarioAdminResponse(usuario.entity());

        assertThat(response.id()).isEqualTo(7L);
        assertThat(response.nombre()).isEqualTo("Gabs");
        assertThat(response.correo()).isEqualTo("admin@museo.com");
        assertThat(response.rol()).isEqualTo("SUPERADMIN");
        assertThat(response.estado()).isEqualTo("ACTIVO");
        assertThat(response.primerInicioSesion()).isFalse();
        assertThat(response.ultimoAccesoEn()).isNotNull();
        assertThat(response.creadoEn()).isNotNull();
        assertThat(response.actualizadoEn()).isNotNull();
    }

    /** Construye una entidad UsuarioAdmin con valores de prueba (reflexión para id/fechas). */
    private static final class UsuarioAdminComprobado {
        private final com.museosmart.entity.UsuarioAdmin u = new com.museosmart.entity.UsuarioAdmin();

        UsuarioAdminComprobado() {
            set("id", 7L);
            u.setNombre("Gabs");
            u.setCorreo("admin@museo.com");
            u.setRol("SUPERADMIN");
            u.setEstado("ACTIVO");
            u.setPrimerInicioSesion(false);
            u.setUltimoAccesoEn(OffsetDateTime.now());
            set("creadoEn", OffsetDateTime.now());
            set("actualizadoEn", OffsetDateTime.now());
        }

        private void set(String campo, Object valor) {
            try {
                java.lang.reflect.Field f = com.museosmart.entity.UsuarioAdmin.class.getDeclaredField(campo);
                f.setAccessible(true);
                f.set(u, valor);
            } catch (ReflectiveOperationException ex) {
                throw new IllegalStateException(ex);
            }
        }

        com.museosmart.entity.UsuarioAdmin entity() {
            return u;
        }
    }
}
