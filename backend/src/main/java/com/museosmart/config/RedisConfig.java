package com.museosmart.config;

import io.lettuce.core.ClientOptions;
import io.lettuce.core.SocketOptions;
import com.museosmart.entity.Alerta;
import com.museosmart.repository.AlertaRepository;
import com.museosmart.repository.redis.AlertaRedisRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.data.redis.LettuceClientConfigurationBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;

import java.time.Duration;
import java.util.List;

/**
 * Configuracion de Redis como capa de ESTADO ACTUAL (no fuente de verdad).
 *
 * <p>Objetivo principal: <b>tolerancia a fallos</b>. Redis puede estar caido y
 * la aplicacion debe seguir arrancando y funcionando con PostgreSQL. Por eso:</p>
 * <ul>
 *   <li>Timeouts cortos de conexion y de comando (por defecto 800 ms): una
 *       operacion contra un Redis caido no bloquea la ingesta MQTT.</li>
 *   <li>Reconexion automatica de Lettuce con espera acotada: al volver Redis,
 *       el estado actual se repuebla solo.</li>
 *   <li>Un sondeo de arranque que SOLO registra un aviso si Redis no responde;
 *       nunca impide el arranque.</li>
 *   <li>El health check de Redis se desactiva en {@code application.properties}
 *       ({@code management.health.redis.enabled=false}) para que una caida de
 *       Redis no marque la aplicacion como DOWN.</li>
 * </ul>
 *
 * <p>Los repositorios de {@code repository.redis} encapsulan las operaciones y
 * usan un manejo tolerante: ante cualquier error devuelven vacio y el servicio
 * cae a PostgreSQL.</p>
 */
@Configuration
public class RedisConfig {

    private static final Logger log = LoggerFactory.getLogger(RedisConfig.class);

    @Bean
    public LettuceClientConfigurationBuilderCustomizer redisTimeoutCustomizer(
            @Value("${spring.data.redis.timeout:800ms}") Duration timeout) {
        return builder -> builder
                .commandTimeout(timeout)
                .clientOptions(ClientOptions.builder()
                        .socketOptions(SocketOptions.builder()
                                .connectTimeout(timeout)
                                .build())
                        .autoReconnect(true)
                        .disconnectedBehavior(ClientOptions.DisconnectedBehavior.REJECT_COMMANDS)
                        .build());
    }

    /**
     * Sondeo informativo al arrancar. No lanza excepcion: si Redis no responde,
     * solo deja constancia de que se usara PostgreSQL como respaldo.
     */
    @Bean
    public ApplicationRunner redisDisponibilidad(RedisConnectionFactory factory,
                                                 AlertaRedisRepository alertaRedis,
                                                 AlertaRepository alertaRepository) {
        return args -> {
            try (var conexion = factory.getConnection()) {
                String pong = conexion.ping();
                log.info("Redis disponible ({}). Estado actual de sensores y alertas activo.", pong);
                // Sincroniza el conteo de alertas activas por si Redis arranco
                // vacio o estuvo caido mientras se creaban/resolvian alertas.
                List<Long> ids = alertaRepository
                        .findByEstadoInOrderByIniciadaEnDesc(
                                List.of(Alerta.ESTADO_ABIERTA, Alerta.ESTADO_RECONOCIDA))
                        .stream().map(Alerta::getId).toList();
                alertaRedis.sincronizar(ids);
            } catch (RuntimeException ex) {
                log.warn("Redis no disponible al arrancar ({}). La aplicacion funcionara con PostgreSQL "
                        + "como respaldo; el estado actual se reintentara cuando Redis vuelva.",
                        ex.getClass().getSimpleName());
            }
        };
    }
}
