package com.museosmart.iot;

import com.museosmart.entity.Alerta;
import com.museosmart.entity.Exhibicion;
import com.museosmart.entity.Sala;
import com.museosmart.entity.Sensor;
import com.museosmart.repository.AlertaRepository;
import com.museosmart.repository.ExhibicionRepository;
import com.museosmart.repository.SalaRepository;
import com.museosmart.repository.SensorRepository;
import com.museosmart.service.AlertaService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pruebas de integracion REAL de alertas contra la base aislada
 * {@code museo_smart_test} (nunca la de desarrollo). Requiere RUN_DB_IT=true.
 *
 * <p>La clase es {@code @Transactional}: todo lo escrito se revierte al final de
 * cada prueba, de modo que no se altera ningun dato permanente ni los limites de
 * las exhibiciones. {@link AlertaService#evaluarAmbiental} es
 * {@code Propagation.MANDATORY} (debe ejecutarse dentro de la transaccion del
 * procesamiento de mensajes), por lo que aqui se invoca dentro de la
 * transaccion de la prueba.</p>
 */
@SpringBootTest
@EnabledIfEnvironmentVariable(named = "RUN_DB_IT", matches = "true")
@Transactional
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
class AlertaIntegracionTest {

    @Autowired
    private AlertaService alertaService;

    @Autowired
    private AlertaRepository alertaRepository;

    @Autowired
    private SensorRepository sensorRepository;

    @Autowired
    private SalaRepository salaRepository;

    @Autowired
    private ExhibicionRepository exhibicionRepository;

    private Sensor sensorAmbiental() {
        Sala sala = salaRepository.findAllByOrderByOrdenAsc().get(0);
        Sensor s = new Sensor();
        s.setCodigo("IT-ALERTA-" + java.util.UUID.randomUUID());
        s.setTipo("MULTI");
        s.setCategoria("AMBIENTAL");
        s.setSala(sala);
        return sensorRepository.saveAndFlush(s);
    }

    private void configurarLimite(Sala sala, BigDecimal tempMin, BigDecimal tempMax) {
        Exhibicion e = exhibicionRepository.findBySalaIdAndActiva(sala.getId(), true).get(0);
        e.setTempMinC(tempMin);
        e.setTempMaxC(tempMax);
        exhibicionRepository.saveAndFlush(e);
    }

    private long alertasActivasDe(Sensor sensor) {
        return alertaRepository.findByEstadoInOrderByIniciadaEnDesc(
                        List.of(Alerta.ESTADO_ABIERTA, Alerta.ESTADO_RECONOCIDA))
                .stream()
                .filter(a -> a.getSensor() != null && a.getSensor().getId().equals(sensor.getId()))
                .count();
    }

    @Test
    @DisplayName("valor fuera de rango abre una alerta ambiental")
    void fueraDeRango_abreAlerta() {
        Sensor sensor = sensorAmbiental();
        configurarLimite(sensor.getSala(), new BigDecimal("10"), new BigDecimal("30"));

        alertaService.evaluarAmbiental(sensor, "TEMPERATURA", 45.0);

        assertThat(alertasActivasDe(sensor)).isEqualTo(1);
    }

    @Test
    @DisplayName("misma condicion no duplica la alerta activa")
    void mismaCondicion_noDuplica() {
        Sensor sensor = sensorAmbiental();
        configurarLimite(sensor.getSala(), new BigDecimal("10"), new BigDecimal("30"));

        alertaService.evaluarAmbiental(sensor, "TEMPERATURA", 45.0);
        alertaService.evaluarAmbiental(sensor, "TEMPERATURA", 47.0);
        alertaService.evaluarAmbiental(sensor, "TEMPERATURA", 49.0);

        assertThat(alertasActivasDe(sensor)).isEqualTo(1);
    }

    @Test
    @DisplayName("volver a rango resuelve la alerta activa")
    void vuelveARango_resuelve() {
        Sensor sensor = sensorAmbiental();
        configurarLimite(sensor.getSala(), new BigDecimal("10"), new BigDecimal("30"));

        alertaService.evaluarAmbiental(sensor, "TEMPERATURA", 45.0);
        assertThat(alertasActivasDe(sensor)).isEqualTo(1);

        alertaService.evaluarAmbiental(sensor, "TEMPERATURA", 22.0);
        assertThat(alertasActivasDe(sensor)).isZero();
    }
}
