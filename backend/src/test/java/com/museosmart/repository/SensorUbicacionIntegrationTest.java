package com.museosmart.repository;

import com.museosmart.entity.Exhibicion;
import com.museosmart.entity.Sala;
import com.museosmart.entity.Sensor;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Prueba de INTEGRACION REAL con PostgreSQL sobre la base AISLADA
 * (museo_smart_test), nunca la base de desarrollo compartida.
 *
 * Solo se ejecuta cuando RUN_DB_IT=true. Los tests son @Transactional, por lo
 * que todos los datos creados se revierten al terminar. Verifica que las
 * restricciones de ubicacion de V7 (categoria/sala/exhibicion/tipo) se aplican
 * realmente en la base de datos y que el mapeo JPA coincide con el esquema.
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
        "app.security.jwt.secret=clave-de-prueba-integracion-suficientemente-larga-1234567890"
})
@Transactional
class SensorUbicacionIntegrationTest {

    @Autowired
    private SensorRepository sensorRepository;

    @Autowired
    private SalaRepository salaRepository;

    @Autowired
    private ExhibicionRepository exhibicionRepository;

    @Autowired
    private EntityManager entityManager;

    private Sala primeraSala() {
        return salaRepository.findAllByOrderByOrdenAsc().get(0);
    }

    private Exhibicion unaExhibicion() {
        List<Exhibicion> todas = exhibicionRepository.findAll();
        assertThat(todas).isNotEmpty();
        return todas.get(0);
    }

    private Sensor ambiental(Sala sala) {
        Sensor s = new Sensor();
        s.setCodigo("IT-AMB-" + System.nanoTime());
        s.setTipo("MULTI");
        s.setCategoria("AMBIENTAL");
        s.setSala(sala);
        return s;
    }

    private Sensor presencia(Exhibicion exhibicion) {
        Sensor s = new Sensor();
        s.setCodigo("IT-PRE-" + System.nanoTime());
        s.setTipo("PRESENCIA");
        s.setCategoria("PRESENCIA");
        s.setExhibicion(exhibicion);
        return s;
    }

    @Test
    @DisplayName("sensor AMBIENTAL por sala se persiste y expone su relacion Sala")
    void ambientalPorSala_sePersiste() {
        Sala sala = primeraSala();
        Sensor guardado = sensorRepository.saveAndFlush(ambiental(sala));

        entityManager.clear();
        Sensor recargado = sensorRepository.findById(guardado.getId()).orElseThrow();

        assertThat(recargado.getSala().getId()).isEqualTo(sala.getId());
        assertThat(recargado.getExhibicion()).isNull();
    }

    @Test
    @DisplayName("sensor PRESENCIA por exhibicion se persiste y expone su relacion Exhibicion")
    void presenciaPorExhibicion_sePersiste() {
        Exhibicion exhibicion = unaExhibicion();
        Sensor guardado = sensorRepository.saveAndFlush(presencia(exhibicion));

        entityManager.clear();
        Sensor recargado = sensorRepository.findById(guardado.getId()).orElseThrow();

        assertThat(recargado.getExhibicion().getId()).isEqualTo(exhibicion.getId());
        assertThat(recargado.getSala()).isNull();
    }

    @Test
    @DisplayName("AMBIENTAL sin sala es rechazado por ck_sensor_ubicacion")
    void ambientalSinSala_esRechazado() {
        Sensor s = ambiental(null);
        s.setExhibicion(unaExhibicion());

        assertThatThrownBy(() -> sensorRepository.saveAndFlush(s))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("PRESENCIA sin exhibicion es rechazado por ck_sensor_ubicacion")
    void presenciaSinExhibicion_esRechazada() {
        Sensor s = presencia(null);
        s.setSala(primeraSala());

        assertThatThrownBy(() -> sensorRepository.saveAndFlush(s))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("categoria PRESENCIA con tipo MULTI es rechazada por ck_sensor_categoria_tipo")
    void presenciaConTipoMulti_esRechazada() {
        Sensor s = presencia(unaExhibicion());
        s.setTipo("MULTI");

        assertThatThrownBy(() -> sensorRepository.saveAndFlush(s))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("tipo antiguo TEMPERATURA ya no es admitido por ck_sensor_tipo")
    void tipoTemperatura_esRechazado() {
        Sensor s = ambiental(primeraSala());
        s.setTipo("TEMPERATURA");

        assertThatThrownBy(() -> sensorRepository.saveAndFlush(s))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
