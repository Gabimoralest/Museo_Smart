package com.museosmart.iot;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.museosmart.iot.dto.MensajeAmbientalDto;
import com.museosmart.iot.dto.MensajePresenciaDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MensajeIotDeserializacionTest {

    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        objectMapper.disable(DeserializationFeature.ADJUST_DATES_TO_CONTEXT_TIME_ZONE);
    }

    @Test
    @DisplayName("ambiental valido se deserializa con todos sus campos")
    void ambientalValido() throws Exception {
        String json = """
                {"mensajeId":"11111111-1111-1111-1111-111111111111",
                 "sensorCodigo":"SENSOR-AMBIENTAL-001","salaId":1,
                 "temperatura":22.5,"humedad":50.0,"luminosidad":300.0,
                 "timestamp":"2026-10-13T21:50:00Z"}
                """;

        MensajeAmbientalDto dto = objectMapper.readValue(json, MensajeAmbientalDto.class);

        assertThat(dto.sensorCodigo()).isEqualTo("SENSOR-AMBIENTAL-001");
        assertThat(dto.salaId()).isEqualTo(1L);
        assertThat(dto.temperatura()).isEqualTo(22.5);
        assertThat(dto.timestamp()).isNotNull();
    }

    @Test
    @DisplayName("presencia valida se deserializa con todos sus campos")
    void presenciaValida() throws Exception {
        String json = """
                {"mensajeId":"22222222-2222-2222-2222-222222222222",
                 "sensorCodigo":"SENSOR-PRESENCIA-001","exhibicionId":3,
                 "presencia":true,"timestamp":"2026-10-13T21:50:00-05:00"}
                """;

        MensajePresenciaDto dto = objectMapper.readValue(json, MensajePresenciaDto.class);

        assertThat(dto.sensorCodigo()).isEqualTo("SENSOR-PRESENCIA-001");
        assertThat(dto.exhibicionId()).isEqualTo(3L);
        assertThat(dto.presencia()).isTrue();
        assertThat(dto.timestamp()).isNotNull();
    }

    @Test
    @DisplayName("UUID invalido provoca error de deserializacion")
    void uuidInvalido() {
        String json = """
                {"mensajeId":"no-es-un-uuid","sensorCodigo":"S1","salaId":1,
                 "temperatura":22.5,"humedad":50.0,"luminosidad":300.0,
                 "timestamp":"2026-10-13T21:50:00Z"}
                """;

        assertThatThrownBy(() -> objectMapper.readValue(json, MensajeAmbientalDto.class))
                .isInstanceOf(Exception.class);
    }

    @Test
    @DisplayName("timestamp invalido provoca error de deserializacion")
    void timestampInvalido() {
        String json = """
                {"mensajeId":"11111111-1111-1111-1111-111111111111","sensorCodigo":"S1","salaId":1,
                 "temperatura":22.5,"humedad":50.0,"luminosidad":300.0,
                 "timestamp":"13-10-2026 21:50"}
                """;

        assertThatThrownBy(() -> objectMapper.readValue(json, MensajeAmbientalDto.class))
                .isInstanceOf(Exception.class);
    }

    @Test
    @DisplayName("campos ausentes quedan en null para que el validador los rechace")
    void camposAusentes() throws Exception {
        String json = "{\"mensajeId\":\"11111111-1111-1111-1111-111111111111\"}";

        MensajeAmbientalDto dto = objectMapper.readValue(json, MensajeAmbientalDto.class);

        assertThat(dto.sensorCodigo()).isNull();
        assertThat(dto.salaId()).isNull();
        assertThat(dto.temperatura()).isNull();
    }
}
