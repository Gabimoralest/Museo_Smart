package com.museosmart.repository.redis;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.redis.core.SetOperations;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AlertaRedisRepositoryTest {

    @Mock
    private StringRedisTemplate redis;

    @Mock
    private SetOperations<String, String> setOps;

    private AlertaRedisRepository repositorio;

    @BeforeEach
    void setUp() {
        when(redis.opsForSet()).thenReturn(setOps);
        repositorio = new AlertaRedisRepository(new RedisSoporte(redis, true));
    }

    @Test
    @DisplayName("marcar activa agrega el id al conjunto")
    void marcarActiva_agregaId() {
        repositorio.marcarActiva(7L);
        verify(setOps).add(RedisClaves.ALERTAS_ABIERTAS, "7");
    }

    @Test
    @DisplayName("marcar resuelta quita el id del conjunto")
    void marcarResuelta_quitaId() {
        repositorio.marcarResuelta(7L);
        verify(setOps).remove(RedisClaves.ALERTAS_ABIERTAS, "7");
    }

    @Test
    @DisplayName("contar abiertas devuelve el tamano del conjunto")
    void contarAbiertas_devuelveTamano() {
        when(setOps.size(RedisClaves.ALERTAS_ABIERTAS)).thenReturn(3L);
        assertThat(repositorio.contarAbiertas()).contains(3L);
    }

    @Test
    @DisplayName("ids abiertas devuelve el conjunto")
    void idsAbiertas_devuelveConjunto() {
        when(setOps.members(RedisClaves.ALERTAS_ABIERTAS)).thenReturn(Set.of("1", "2"));
        Optional<Set<String>> ids = repositorio.idsAbiertas();
        assertThat(ids).isPresent();
        assertThat(ids.get()).containsExactlyInAnyOrder("1", "2");
    }

    @Test
    @DisplayName("sincronizar reemplaza el conjunto")
    void sincronizar_reemplazaConjunto() {
        repositorio.sincronizar(java.util.List.of(10L, 11L));
        verify(redis).delete(RedisClaves.ALERTAS_ABIERTAS);
        verify(setOps).add(eq(RedisClaves.ALERTAS_ABIERTAS), eq("10"));
        verify(setOps).add(eq(RedisClaves.ALERTAS_ABIERTAS), eq("11"));
    }

    @Test
    @DisplayName("si Redis falla, contar abiertas devuelve vacio (fallback a PostgreSQL)")
    void contarAbiertas_fallo_devuelveVacio() {
        when(setOps.size(anyString())).thenThrow(
                new org.springframework.data.redis.RedisConnectionFailureException("caido"));
        assertThat(repositorio.contarAbiertas()).isEmpty();
    }
}
