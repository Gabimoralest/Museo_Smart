package com.museosmart.repository.redis;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.SetOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;

/**
 * Pruebas del comportamiento tolerante a fallos de la capa Redis. Lo mas
 * importante es que una caida de Redis NUNCA propague una excepcion: los
 * repositorios devuelven vacio y los servicios usan PostgreSQL.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RedisSoporteTest {

    @Mock
    private StringRedisTemplate redis;

    @Mock
    private HashOperations<String, Object, Object> hashOps;

    @Mock
    private SetOperations<String, String> setOps;

    @Mock
    private ValueOperations<String, String> valueOps;

    private RedisSoporte soporte;

    @BeforeEach
    void setUp() {
        when(redis.opsForHash()).thenReturn(hashOps);
        when(redis.opsForSet()).thenReturn(setOps);
        when(redis.opsForValue()).thenReturn(valueOps);
        soporte = new RedisSoporte(redis, true);
    }

    @Test
    @DisplayName("una excepcion de Redis en lectura se traduce en Optional vacio")
    void lectura_fallo_devuelveVacio() {
        when(redis.opsForHash()).thenThrow(new RedisConnectionFailureException("caido"));

        Optional<Object> resultado = soporte.leer("t", () -> redis.opsForHash().entries("x"));

        assertThat(resultado).isEmpty();
    }

    @Test
    @DisplayName("una excepcion de Redis en escritura no se propaga")
    void escritura_fallo_noPropaga() {
        doThrow(new RedisConnectionFailureException("caido")).when(redis).delete(anyString());

        assertThatCode(() -> soporte.escribir("t", () -> redis.delete("x")))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("lectura correcta devuelve el valor")
    void lectura_ok_devuelveValor() {
        when(hashOps.entries(anyString())).thenReturn(Map.of("k", "v"));

        Optional<Object> resultado = soporte.leer("t", () -> hashOps.entries("x"));

        assertThat(resultado).isPresent();
    }

    @Test
    @DisplayName("deshabilitado no toca Redis y devuelve vacio")
    void deshabilitado_noTocaRedis() {
        RedisSoporte off = new RedisSoporte(redis, false);

        assertThat(off.leer("t", () -> hashOps.entries("x"))).isEmpty();
        assertThatCode(() -> off.escribir("t", () -> redis.delete("x")))
                .doesNotThrowAnyException();
    }
}
