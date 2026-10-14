package com.museosmart.iot;

import com.museosmart.iot.dto.MensajeAmbientalDto;
import com.museosmart.iot.dto.MensajePresenciaDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MensajeIotValidadorTest {

    private static final OffsetDateTime AHORA = OffsetDateTime.now(ZoneOffset.UTC);

    private MensajeIotValidador validador;

    @BeforeEach
    void setUp() {
        validador = new MensajeIotValidador(new IotLimitesProperties());
    }

    private MensajeAmbientalDto ambientalValido() {
        return new MensajeAmbientalDto(UUID.randomUUID(), "SENSOR-AMBIENTAL-001", 1L,
                22.5, 50.0, 300.0, AHORA);
    }

    private MensajePresenciaDto presenciaValida() {
        return new MensajePresenciaDto(UUID.randomUUID(), "SENSOR-PRESENCIA-001", 1L, true, AHORA);
    }

    @Test
    @DisplayName("ambiental valido no lanza excepcion")
    void ambientalValido_ok() {
        assertThatCode(() -> validador.validarAmbiental(ambientalValido())).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("presencia valida no lanza excepcion")
    void presenciaValida_ok() {
        assertThatCode(() -> validador.validarPresencia(presenciaValida())).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("mensajeId ausente es rechazado")
    void mensajeIdAusente_esRechazado() {
        MensajeAmbientalDto dto = new MensajeAmbientalDto(null, "S1", 1L, 20.0, 50.0, 100.0, AHORA);
        assertThatThrownBy(() -> validador.validarAmbiental(dto))
                .isInstanceOf(MensajeInvalidoException.class)
                .hasMessageContaining("mensajeId");
    }

    @Test
    @DisplayName("sensorCodigo vacio es rechazado")
    void codigoVacio_esRechazado() {
        MensajeAmbientalDto dto = new MensajeAmbientalDto(UUID.randomUUID(), "  ", 1L, 20.0, 50.0, 100.0, AHORA);
        assertThatThrownBy(() -> validador.validarAmbiental(dto))
                .isInstanceOf(MensajeInvalidoException.class)
                .hasMessageContaining("sensorCodigo");
    }

    @Test
    @DisplayName("timestamp ausente es rechazado")
    void timestampAusente_esRechazado() {
        MensajeAmbientalDto dto = new MensajeAmbientalDto(UUID.randomUUID(), "S1", 1L, 20.0, 50.0, 100.0, null);
        assertThatThrownBy(() -> validador.validarAmbiental(dto))
                .isInstanceOf(MensajeInvalidoException.class)
                .hasMessageContaining("timestamp");
    }

    @Test
    @DisplayName("salaId ausente es rechazado en ambiental")
    void salaIdAusente_esRechazado() {
        MensajeAmbientalDto dto = new MensajeAmbientalDto(UUID.randomUUID(), "S1", null, 20.0, 50.0, 100.0, AHORA);
        assertThatThrownBy(() -> validador.validarAmbiental(dto))
                .isInstanceOf(MensajeInvalidoException.class)
                .hasMessageContaining("salaId");
    }

    @Test
    @DisplayName("temperatura fuera de rango es rechazada")
    void temperaturaFueraDeRango_esRechazada() {
        MensajeAmbientalDto dto = new MensajeAmbientalDto(UUID.randomUUID(), "S1", 1L, 500.0, 50.0, 100.0, AHORA);
        assertThatThrownBy(() -> validador.validarAmbiental(dto))
                .isInstanceOf(MensajeInvalidoException.class)
                .hasMessageContaining("temperatura");
    }

    @Test
    @DisplayName("humedad fuera de [0,100] es rechazada")
    void humedadFueraDeRango_esRechazada() {
        MensajeAmbientalDto dto = new MensajeAmbientalDto(UUID.randomUUID(), "S1", 1L, 20.0, 150.0, 100.0, AHORA);
        assertThatThrownBy(() -> validador.validarAmbiental(dto))
                .isInstanceOf(MensajeInvalidoException.class)
                .hasMessageContaining("humedad");
    }

    @Test
    @DisplayName("valor NaN es rechazado (no finito)")
    void nan_esRechazado() {
        MensajeAmbientalDto dto = new MensajeAmbientalDto(UUID.randomUUID(), "S1", 1L, Double.NaN, 50.0, 100.0, AHORA);
        assertThatThrownBy(() -> validador.validarAmbiental(dto))
                .isInstanceOf(MensajeInvalidoException.class)
                .hasMessageContaining("finito");
    }

    @Test
    @DisplayName("presencia ausente es rechazada")
    void presenciaAusente_esRechazada() {
        MensajePresenciaDto dto = new MensajePresenciaDto(UUID.randomUUID(), "P1", 1L, null, AHORA);
        assertThatThrownBy(() -> validador.validarPresencia(dto))
                .isInstanceOf(MensajeInvalidoException.class)
                .hasMessageContaining("presencia");
    }

    @Test
    @DisplayName("exhibicionId ausente es rechazado en presencia")
    void exhibicionIdAusente_esRechazado() {
        MensajePresenciaDto dto = new MensajePresenciaDto(UUID.randomUUID(), "P1", null, true, AHORA);
        assertThatThrownBy(() -> validador.validarPresencia(dto))
                .isInstanceOf(MensajeInvalidoException.class)
                .hasMessageContaining("exhibicionId");
    }
}
