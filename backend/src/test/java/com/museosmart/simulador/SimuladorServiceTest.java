package com.museosmart.simulador;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.museosmart.config.SecurityConfig;
import com.museosmart.entity.Sala;
import com.museosmart.exception.GlobalExceptionHandler;
import com.museosmart.exception.RecursoNoEncontradoException;
import com.museosmart.exception.ReglaNegocioException;
import com.museosmart.repository.SalaRepository;
import com.museosmart.repository.SensorRepository;
import com.museosmart.security.JwtAuthenticationFilter;
import com.museosmart.security.JwtService;
import com.museosmart.security.PrimerInicioSesionFilter;
import com.museosmart.security.RestSecurityHandlers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Valida la logica de escenarios: normalizacion y validacion de parametros,
 * resolucion de sala por id/codigo 3D/nombre y publicacion en MQTT. No toca
 * alertas, Redis ni InfluxDB.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SimuladorServiceTest {

    @Mock
    private SimuladorPublicador publicador;

    @Mock
    private SimuladorEstadoListener estadoListener;

    @Mock
    private SalaRepository salaRepository;

    @Mock
    private SensorRepository sensorRepository;

    private SimuladorService servicio;

    @BeforeEach
    void setUp() {
        SimuladorProperties props = new SimuladorProperties();
        props.setHabilitado(true);
        servicio = new SimuladorService(props, publicador, estadoListener,
                salaRepository, sensorRepository, new ObjectMapper());
        when(estadoListener.estado()).thenReturn(SimuladorEstadoResponse.vacio());
        when(salaRepository.findAllByOrderByOrdenAsc()).thenReturn(List.of(
                sala(1L, "SALA_1", "Pintura histórica"),
                sala(23L, "SALA_5", "Escultura y retratos")));
    }

    private Sala sala(Long id, String codigo3d, String nombre) {
        Sala s = new Sala();
        try {
            var f = Sala.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(s, id);
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException(ex);
        }
        s.setCodigo3d(codigo3d);
        s.setNombre(nombre);
        s.setOrden((short) 1);
        return s;
    }

    @Test
    @DisplayName("FALLA_CLIMA resuelve la sala por codigo 3D y publica la orden")
    void activar_resuelveSalaPorCodigo3d() {
        servicio.activar(new EscenarioRequest("FALLA_CLIMA", "SALA_1", null), "super@museo.co");

        ArgumentCaptor<String> topico = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);
        verify(publicador).publicar(topico.capture(), json.capture(), anyBoolean());
        assertThat(topico.getValue()).isEqualTo("museo/simulador/escenario");
        assertThat(json.getValue()).contains("\"tipo\":\"FALLA_CLIMA\"")
                .contains("\"sala\":\"SALA_1\"");
    }

    @Test
    @DisplayName("la sala tambien se resuelve por id real")
    void activar_resuelveSalaPorId() {
        servicio.activar(new EscenarioRequest("HUMEDAD_ALTA", "23", null), "super@museo.co");
        ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);
        verify(publicador).publicar(anyString(), json.capture(), anyBoolean());
        assertThat(json.getValue()).contains("\"sala\":\"SALA_5\"");
    }

    @Test
    @DisplayName("un tipo desconocido se rechaza con 400")
    void activar_tipoInvalido() {
        assertThatThrownBy(() -> servicio.activar(
                new EscenarioRequest("NO_EXISTE", "SALA_1", null), "super@museo.co"))
                .isInstanceOf(ReglaNegocioException.class)
                .hasMessageContaining("Tipo de escenario invalido");
    }

    @Test
    @DisplayName("una sala inexistente produce 404")
    void activar_salaInexistente() {
        assertThatThrownBy(() -> servicio.activar(
                new EscenarioRequest("EXCESO_LUZ", "SALA_99", null), "super@museo.co"))
                .isInstanceOf(RecursoNoEncontradoException.class);
    }

    @Test
    @DisplayName("GRUPO_VISITANTES exige sala")
    void activar_grupoSinSala() {
        assertThatThrownBy(() -> servicio.activar(
                new EscenarioRequest("GRUPO_VISITANTES", null, null), "super@museo.co"))
                .isInstanceOf(ReglaNegocioException.class);
    }

    @Test
    @DisplayName("SENSOR_DESCONECTADO exige un sensor existente")
    void activar_sensorInexistente() {
        when(sensorRepository.findByCodigo("SENSOR-X")).thenReturn(java.util.Optional.empty());
        assertThatThrownBy(() -> servicio.activar(
                new EscenarioRequest("SENSOR_DESCONECTADO", null, "SENSOR-X"), "super@museo.co"))
                .isInstanceOf(RecursoNoEncontradoException.class);
    }

    @Test
    @DisplayName("RESTABLECER todo publica la orden correspondiente")
    void restablecer_todo() {
        servicio.restablecer(new RestablecerRequest(null, null, true), "super@museo.co");
        ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);
        verify(publicador).publicar(anyString(), json.capture(), anyBoolean());
        assertThat(json.getValue()).contains("\"tipo\":\"RESTABLECER\"")
                .contains("\"todo\":true");
    }

    @Test
    @DisplayName("RESTABLECER por sensor concreto publica ese sensor")
    void restablecer_porSensor() {
        com.museosmart.entity.Sensor sensor = new com.museosmart.entity.Sensor();
        sensor.setCodigo("SENSOR-AMBIENTAL-001");
        when(sensorRepository.findByCodigo("SENSOR-AMBIENTAL-001"))
                .thenReturn(java.util.Optional.of(sensor));
        servicio.restablecer(new RestablecerRequest(null, "SENSOR-AMBIENTAL-001", false), "super@museo.co");
        ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);
        verify(publicador).publicar(anyString(), json.capture(), anyBoolean());
        assertThat(json.getValue()).contains("\"sensorCodigo\":\"SENSOR-AMBIENTAL-001\"");
    }

    @Test
    @DisplayName("RESTABLECER sin sala ni todo se rechaza")
    void restablecer_sinObjetivo() {
        assertThatThrownBy(() -> servicio.restablecer(
                new RestablecerRequest(null, null, false), "super@museo.co"))
                .isInstanceOf(ReglaNegocioException.class);
    }

    @Test
    @DisplayName("el horario forzado se publica en su topic")
    void horarioForzado_publica() {
        servicio.horarioForzado(true, "super@museo.co");
        ArgumentCaptor<String> topico = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);
        verify(publicador).publicar(topico.capture(), json.capture(), eq(false));
        assertThat(topico.getValue()).isEqualTo("museo/simulador/horario");
        assertThat(json.getValue()).contains("\"activo\":true");
    }
}
