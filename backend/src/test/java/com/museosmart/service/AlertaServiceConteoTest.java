package com.museosmart.service;

import com.museosmart.entity.Alerta;
import com.museosmart.repository.AlertaRepository;
import com.museosmart.repository.redis.AlertaRedisRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * El conteo de alertas de la campana debe salir de Redis y, si Redis no
 * responde, de PostgreSQL. Nunca debe fallar.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AlertaServiceConteoTest {

    @Mock
    private AlertaRepository alertaRepository;

    @Mock
    private com.museosmart.repository.ExhibicionRepository exhibicionRepository;

    @Mock
    private AlertaRedisRepository alertaRedis;

    private AlertaService alertaService;

    @BeforeEach
    void setUp() {
        alertaService = new AlertaService(alertaRepository, exhibicionRepository, alertaRedis);
    }

    @Test
    @DisplayName("con Redis disponible devuelve el conteo de Redis")
    void contarAbiertas_usaRedis() {
        when(alertaRedis.contarAbiertas()).thenReturn(Optional.of(4L));

        assertThat(alertaService.contarAbiertas()).isEqualTo(4L);
    }

    @Test
    @DisplayName("con Redis caido cuenta en PostgreSQL")
    void contarAbiertas_fallbackPostgres() {
        when(alertaRedis.contarAbiertas()).thenReturn(Optional.empty());
        when(alertaRepository.countByEstado(Alerta.ESTADO_ABIERTA)).thenReturn(2L);
        when(alertaRepository.countByEstado(Alerta.ESTADO_RECONOCIDA)).thenReturn(1L);

        assertThat(alertaService.contarAbiertas()).isEqualTo(3L);
    }
}
