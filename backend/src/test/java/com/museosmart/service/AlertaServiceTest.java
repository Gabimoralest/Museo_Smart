package com.museosmart.service;

import com.museosmart.entity.Alerta;
import com.museosmart.entity.Exhibicion;
import com.museosmart.entity.Sala;
import com.museosmart.entity.Sensor;
import com.museosmart.repository.AlertaRepository;
import com.museosmart.repository.ExhibicionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AlertaServiceTest {

    @Mock
    private AlertaRepository alertaRepository;

    @Mock
    private ExhibicionRepository exhibicionRepository;

    private AlertaService alertaService;

    @BeforeEach
    void setUp() {
        alertaService = new AlertaService(alertaRepository, exhibicionRepository);
    }

    private Sensor sensorAmbiental(Long salaId) {
        Sala sala = new Sala();
        setField(sala, "id", salaId);
        Sensor s = new Sensor();
        setField(s, "id", 10L);
        s.setCodigo("SENSOR-AMBIENTAL-001");
        s.setCategoria("AMBIENTAL");
        s.setSala(sala);
        return s;
    }

    private Exhibicion exhibicionConLimites(BigDecimal tMin, BigDecimal tMax) {
        Exhibicion e = new Exhibicion();
        e.setTempMinC(tMin);
        e.setTempMaxC(tMax);
        return e;
    }

    @Test
    @DisplayName("valor dentro de rango no abre alerta y resuelve la activa si existe")
    void dentroDeRango_resuelveActiva() {
        Sensor sensor = sensorAmbiental(1L);
        when(exhibicionRepository.findBySalaIdAndActiva(eq(1L), eq(true)))
                .thenReturn(List.of(exhibicionConLimites(new BigDecimal("10"), new BigDecimal("30"))));

        Alerta activa = new Alerta();
        activa.setEstado(Alerta.ESTADO_ABIERTA);
        when(alertaRepository.findBySensorIdAndCondicionClaveAndEstadoIn(anyLong(), anyString(), any()))
                .thenReturn(Optional.of(activa));
        when(alertaRepository.save(any(Alerta.class))).thenAnswer(inv -> inv.getArgument(0));

        alertaService.evaluarAmbiental(sensor, "TEMPERATURA", 22.0);

        assertThat(activa.getEstado()).isEqualTo(Alerta.ESTADO_RESUELTA);
        assertThat(activa.getResueltaEn()).isNotNull();
    }

    @Test
    @DisplayName("valor por encima del máximo abre una alerta nueva")
    void fueraDeRango_abreAlerta() {
        Sensor sensor = sensorAmbiental(1L);
        when(exhibicionRepository.findBySalaIdAndActiva(eq(1L), eq(true)))
                .thenReturn(List.of(exhibicionConLimites(new BigDecimal("10"), new BigDecimal("30"))));
        when(alertaRepository.findBySensorIdAndCondicionClaveAndEstadoIn(anyLong(), anyString(), any()))
                .thenReturn(Optional.empty());
        when(alertaRepository.save(any(Alerta.class))).thenAnswer(inv -> inv.getArgument(0));

        alertaService.evaluarAmbiental(sensor, "TEMPERATURA", 45.0);

        ArgumentCaptor<Alerta> captor = ArgumentCaptor.forClass(Alerta.class);
        verify(alertaRepository).save(captor.capture());
        Alerta guardada = captor.getValue();
        assertThat(guardada.getEstado()).isEqualTo(Alerta.ESTADO_ABIERTA);
        assertThat(guardada.getCondicionClave()).isEqualTo("AMBIENTAL_TEMPERATURA");
        assertThat(guardada.getDescripcion()).contains("45");
    }

    @Test
    @DisplayName("misma condición activa no duplica la alerta")
    void condicionActiva_noDuplica() {
        Sensor sensor = sensorAmbiental(1L);
        when(exhibicionRepository.findBySalaIdAndActiva(eq(1L), eq(true)))
                .thenReturn(List.of(exhibicionConLimites(new BigDecimal("10"), new BigDecimal("30"))));
        when(alertaRepository.findBySensorIdAndCondicionClaveAndEstadoIn(anyLong(), anyString(), any()))
                .thenReturn(Optional.of(new Alerta()));

        alertaService.evaluarAmbiental(sensor, "TEMPERATURA", 45.0);

        verify(alertaRepository, never()).save(any(Alerta.class));
    }

    @Test
    @DisplayName("sensor sin límites configurados no genera ni resuelve alertas")
    void sinLimites_noHaceNada() {
        Sensor sensor = sensorAmbiental(1L);
        when(exhibicionRepository.findBySalaIdAndActiva(eq(1L), eq(true)))
                .thenReturn(List.of(exhibicionConLimites(null, null)));

        alertaService.evaluarAmbiental(sensor, "TEMPERATURA", 99.0);

        verify(alertaRepository, never()).save(any(Alerta.class));
        verify(alertaRepository, never()).findBySensorIdAndCondicionClaveAndEstadoIn(anyLong(), anyString(), any());
    }

    private static void setField(Object target, String name, Object value) {
        try {
            var f = target.getClass().getDeclaredField(name);
            f.setAccessible(true);
            f.set(target, value);
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
