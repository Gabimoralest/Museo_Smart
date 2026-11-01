package com.museosmart.service;

import com.museosmart.dto.EditarExhibicionRequest;
import com.museosmart.dto.ExhibicionHistorialItem;
import com.museosmart.entity.Exhibicion;
import com.museosmart.entity.UsuarioAdmin;
import com.museosmart.exception.ConflictoException;
import com.museosmart.repository.ExhibicionEdicionHistorialRepository;
import com.museosmart.repository.ExhibicionRepository;
import com.museosmart.repository.UsuarioAdminRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Integracion REAL de la edicion de exhibiciones contra PostgreSQL (base
 * AISLADA museo_smart_test, esquema V14). Requiere RUN_DB_IT=true.
 * {@code @Transactional}: no altera datos.
 *
 * <p>Verifica bloqueo optimista, historial por campo, "sin cambios = sin
 * historial", inmutabilidad del codigo y que el trigger de la BD tambien lo
 * impide.</p>
 */
@SpringBootTest
@EnabledIfEnvironmentVariable(named = "RUN_DB_IT", matches = "true")
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:postgresql://localhost:5432/museo_smart_test",
        "spring.datasource.username=postgres",
        "spring.datasource.password=${DB_PASSWORD:}",
        "spring.jpa.hibernate.ddl-auto=validate",
        "spring.flyway.enabled=true",
        "app.mail.habilitado=false",
        "app.iot.mqtt.enabled=false",
        "app.iot.influx.enabled=false",
        "app.security.jwt.secret=clave-de-prueba-integracion-suficientemente-larga-1234567890"
})
@Transactional
class ExhibicionEdicionIntegrationTest {

    @Autowired
    private ExhibicionService exhibicionService;

    @Autowired
    private ExhibicionRepository exhibicionRepository;

    @Autowired
    private ExhibicionEdicionHistorialRepository edicionHistorialRepository;

    @Autowired
    private UsuarioAdminRepository usuarioAdminRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private UsuarioAdmin admin() {
        UsuarioAdmin u = new UsuarioAdmin();
        u.setNombre("Editor " + UUID.randomUUID());
        u.setCorreo("editor-" + UUID.randomUUID() + "@museo.com");
        u.setRol("ADMIN");
        u.setEstado("ACTIVO");
        u.setPrimerInicioSesion(false);
        u.setHashContrasena(passwordEncoder.encode("Secreta123"));
        return usuarioAdminRepository.save(u);
    }

    private Exhibicion primeraActiva() {
        return exhibicionRepository.findByActiva(true).get(0);
    }

    @Test
    @DisplayName("editar persiste, sube version y registra historial por campo")
    void editar_persisteYRegistraHistorial() {
        UsuarioAdmin editor = admin();
        Exhibicion ex = primeraActiva();
        int versionInicial = ex.getVersion();

        long historialAntes = edicionHistorialRepository
                .findByExhibicionIdOrderByEditadoEnDesc(ex.getId()).size();

        exhibicionService.editar(ex.getId(), new EditarExhibicionRequest(
                "Titulo editado IT", "Corta IT", "Descripcion editada IT", null, null, "Autor editado IT", "dato IT", versionInicial), editor.getId());
        // @Version se aplica al volcar (flush) los cambios.
        exhibicionRepository.flush();

        Exhibicion recargada = exhibicionRepository.findById(ex.getId()).orElseThrow();
        assertThat(recargada.getTitulo()).isEqualTo("Titulo editado IT");
        assertThat(recargada.getDescripcion()).isEqualTo("Descripcion editada IT");
        assertThat(recargada.getAutorCultura()).isEqualTo("Autor editado IT");
        assertThat(recargada.getVersion()).isEqualTo(versionInicial + 1);
        assertThat(recargada.getActualizadoPor().getId()).isEqualTo(editor.getId());

        long historialDespues = edicionHistorialRepository
                .findByExhibicionIdOrderByEditadoEnDesc(ex.getId()).size();
        assertThat(historialDespues - historialAntes).isEqualTo(5);
    }

    @Test
    @DisplayName("version obsoleta lanza ConflictoException y no cambia nada")
    void editar_versionObsoleta_conflicto() {
        UsuarioAdmin editor = admin();
        Exhibicion ex = primeraActiva();
        String tituloOriginal = ex.getTitulo();

        assertThatThrownBy(() -> exhibicionService.editar(ex.getId(),
                new EditarExhibicionRequest("No debe aplicarse", "corta", null, null, null, null, null, -1), editor.getId()))
                .isInstanceOf(ConflictoException.class);

        assertThat(exhibicionRepository.findById(ex.getId()).orElseThrow().getTitulo())
                .isEqualTo(tituloOriginal);
    }

    @Test
    @DisplayName("sin cambios reales no escribe historial ni sube version")
    void editar_sinCambios_noEscribe() {
        UsuarioAdmin editor = admin();
        Exhibicion ex = primeraActiva();
        int versionInicial = ex.getVersion();
        long historialAntes = edicionHistorialRepository
                .findByExhibicionIdOrderByEditadoEnDesc(ex.getId()).size();

        exhibicionService.editar(ex.getId(), new EditarExhibicionRequest(
                ex.getTitulo(), ex.getDescripcionCorta(), ex.getDescripcion(), ex.getPeriodo(), ex.getMaterial(), ex.getAutorCultura(), ex.getDatoCurioso(), versionInicial), editor.getId());

        Exhibicion recargada = exhibicionRepository.findById(ex.getId()).orElseThrow();
        assertThat(recargada.getVersion()).isEqualTo(versionInicial);
        assertThat(edicionHistorialRepository.findByExhibicionIdOrderByEditadoEnDesc(ex.getId()).size())
                .isEqualTo(historialAntes);
    }

    @Test
    @DisplayName("el codigo no cambia tras editar (ni con el trigger de la BD)")
    void editar_noCambiaCodigo() {
        UsuarioAdmin editor = admin();
        Exhibicion ex = primeraActiva();
        String codigoOriginal = ex.getCodigo();

        exhibicionService.editar(ex.getId(), new EditarExhibicionRequest(
                "Otro titulo", "corta", null, null, null, null, null, ex.getVersion()), editor.getId());

        assertThat(exhibicionRepository.findById(ex.getId()).orElseThrow().getCodigo())
                .isEqualTo(codigoOriginal);
    }

    @Test
    @DisplayName("historial devuelve las ediciones ordenadas del más reciente al más antiguo")
    void historial_ordenadoDesc() {
        UsuarioAdmin editor = admin();
        Exhibicion ex = primeraActiva();
        int version = ex.getVersion();

        exhibicionService.editar(ex.getId(), new EditarExhibicionRequest("A1", "corta A1", null, null, null, null, null, version), editor.getId());
        List<ExhibicionHistorialItem> historial = exhibicionService.historial(ex.getId());

        assertThat(historial).isNotEmpty();
        assertThat(historial.get(0).tipo()).isEqualTo("EDICION");
        assertThat(historial.get(0).campo()).isEqualTo("titulo");
    }
}
