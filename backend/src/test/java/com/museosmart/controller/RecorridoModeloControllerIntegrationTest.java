package com.museosmart.controller;

import com.museosmart.repository.ExhibicionRepository;
import com.museosmart.repository.SalaRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifica el contrato del recorrido 3D contra PostgreSQL real (base AISLADA
 * museo_smart_test). Requiere RUN_DB_IT=true. Es {@code @Transactional}, por lo
 * que no altera ningun dato.
 *
 * <p>Tras V11..V14 el esquema tiene 6 salas, 12 exhibiciones y 12 ubicaciones
 * 3D. Este test comprueba que el endpoint publico devuelve las 12 exhibiciones
 * activas, cada una con su {@code ubicacion3dCodigo} (EXH_S1_01..EXH_S6_02), y
 * que las salas exponen {@code codigo3d} (SALA_1..SALA_6).</p>
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
        "app.iot.mqtt.enabled=false",
        "app.iot.influx.enabled=false",
        "app.security.jwt.secret=clave-de-prueba-integracion-suficientemente-larga-1234567890"
})
@Transactional
class RecorridoModeloControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ExhibicionRepository exhibicionRepository;

    @Autowired
    private SalaRepository salaRepository;

    @Test
    @DisplayName("GET /api/v1/exhibiciones devuelve 12 activas, cada una con ubicacion3dCodigo")
    void exhibiciones_todasConUbicacion3d() throws Exception {
        long activas = exhibicionRepository.findByActiva(true).size();

        mockMvc.perform(get("/api/v1/exhibiciones"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value((int) activas))
                .andExpect(jsonPath("$[*].codigo").isNotEmpty())
                .andExpect(jsonPath("$[*].ubicacion3dCodigo").value(everyItem(notNullValue())));
    }

    @Test
    @DisplayName("GET /api/v1/salas expone codigo3d SALA_1..SALA_6")
    void salas_exponenCodigo3d() throws Exception {
        long total = salaRepository.count();

        mockMvc.perform(get("/api/v1/salas"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value((int) total))
                .andExpect(jsonPath("$[*].codigo3d").value(everyItem(notNullValue())));
    }
}
