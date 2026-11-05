package com.museosmart.repository.redis;

import com.museosmart.entity.Exhibicion;
import com.museosmart.entity.Sala;
import com.museosmart.entity.Sensor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.SetOperations;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.lang.reflect.Field;
import java.time.OffsetDateTime;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class EstadoSensorRedisRepositoryTest {

    @Mock
    private StringRedisTemplate redis;

    @Mock
    private HashOperations<String, Object, Object> hashOps;

    @Mock
    private SetOperations<String, String> setOps;

    private EstadoSensorRedisRepository repositorio;

    @BeforeEach
    void setUp() {
        when(redis.opsForHash()).thenReturn(hashOps);
        when(redis.opsForSet()).thenReturn(setOps);
        repositorio = new EstadoSensorRedisRepository(new RedisSoporte(redis, true), 300);
    }

    private Sensor sensorAmbiental() {
        Sala sala = new Sala();
        setId(sala, 23L);
        Sensor s = new Sensor();
        setId(s, 42L);
        s.setCodigo("SENSOR-AMBIENTAL-005");
        s.setCategoria("AMBIENTAL");
        s.setSala(sala);
        return s;
    }

    private Sensor sensorPresencia() {
        Exhibicion ex = new Exhibicion();
        setId(ex, 14L);
        Sensor s = new Sensor();
        setId(s, 55L);
        s.setCodigo("SENSOR-PRESENCIA-009");
        s.setCategoria("PRESENCIA");
        s.setExhibicion(ex);
        return s;
    }

    @Test
    @DisplayName("guarda temperatura, humedad y luz con TTL de 5 minutos")
    @SuppressWarnings("unchecked")
    void guardarAmbiental_escribeHashConTtl() {
        OffsetDateTime ahora = OffsetDateTime.parse("2026-11-04T20:00:00Z");

        repositorio.guardarAmbiental(sensorAmbiental(), 20.5, 45.0, 150.0, ahora, "PENDIENTE");

        ArgumentCaptor<Map<String, String>> captor = ArgumentCaptor.forClass(Map.class);
        verify(hashOps).putAll(eq("museo:sensor:SENSOR-AMBIENTAL-005"), captor.capture());
        Map<String, String> campos = captor.getValue();
        assertThat(campos.get("t.valor")).isEqualTo("20.5");
        assertThat(campos.get("h.valor")).isEqualTo("45.0");
        assertThat(campos.get("l.valor")).isEqualTo("150.0");
        assertThat(campos.get("salaId")).isEqualTo("23");
        assertThat(campos.get("actualizadoEn")).isEqualTo(ahora.toString());
        verify(redis).expire(eq("museo:sensor:SENSOR-AMBIENTAL-005"),
                eq(java.time.Duration.ofSeconds(300)));
        // Resumen de sala
        verify(hashOps).putAll(eq("museo:sala:23"), any());
    }

    @Test
    @DisplayName("guarda presencia (1/0) y el hash por exhibicion")
    void guardarPresencia_escribePresenciaYExhibicion() {
        OffsetDateTime ahora = OffsetDateTime.parse("2026-11-04T20:00:00Z");

        repositorio.guardarPresencia(sensorPresencia(), true, ahora, "PENDIENTE");

        verify(hashOps).putAll(eq("museo:sensor:SENSOR-PRESENCIA-009"), any());
        verify(hashOps).putAll(eq("museo:exhibicion:14:presencia"), any());
        verify(redis).expire(eq("museo:sensor:SENSOR-PRESENCIA-009"),
                eq(java.time.Duration.ofSeconds(300)));
    }

    @Test
    @DisplayName("actualiza el estado de outbox solo si la marca temporal coincide")
    void actualizarEstado_soloSiCoincide() {
        OffsetDateTime medido = OffsetDateTime.parse("2026-11-04T20:00:00Z");
        when(hashOps.get("museo:sensor:SENSOR-AMBIENTAL-005", "t.medidoEn"))
                .thenReturn(medido.toString());

        repositorio.actualizarEstado("SENSOR-AMBIENTAL-005", "TEMPERATURA", medido, "ENVIADO");

        verify(hashOps).put("museo:sensor:SENSOR-AMBIENTAL-005", "t.estado", "ENVIADO");
    }

    @Test
    @DisplayName("no actualiza si la marca temporal no coincide (lectura mas reciente)")
    void actualizarEstado_noPisaLecturaMasReciente() {
        when(hashOps.get(anyString(), anyString()))
                .thenReturn("2026-11-04T21:00:00Z");

        repositorio.actualizarEstado("SENSOR-AMBIENTAL-005", "TEMPERATURA",
                OffsetDateTime.parse("2026-11-04T20:00:00Z"), "ENVIADO");

        org.mockito.Mockito.verify(hashOps, org.mockito.Mockito.never())
                .put(anyString(), anyString(), anyString());
    }

    private static void setId(Object entidad, Long id) {
        try {
            Field f = entidad.getClass().getDeclaredField("id");
            f.setAccessible(true);
            f.set(entidad, id);
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
