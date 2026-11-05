package com.museosmart.repository.redis;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.OffsetDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pruebas de integracion REAL contra el Redis de Docker (localhost:6380),
 * usando una clave de prueba con prefijo propio para no tocar datos reales.
 * Requiere RUN_REDIS_IT=true y Redis accesible.
 *
 * <p>No se apunta a la base de datos: se usa una configuracion minima del
 * contexto Spring (solo el cliente Redis y los repositorios). El datasource de
 * PostgreSQL se toma del entorno como en el resto de pruebas.</p>
 */
@SpringBootTest
@EnabledIfEnvironmentVariable(named = "RUN_REDIS_IT", matches = "true")
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
class RedisIntegracionTest {

    private static final String CLAVE_PRUEBA = "museo:test:integracion";

    @Autowired
    private StringRedisTemplate redis;

    @Autowired
    private RedisSoporte soporte;

    @AfterEach
    void limpiar() {
        redis.delete(CLAVE_PRUEBA);
        redis.delete(RedisClaves.ALERTAS_ABIERTAS);
    }

    @Test
    @DisplayName("Redis responde ping y acepta escritura/lectura con TTL")
    void redis_respondeYEscribe() {
        soporte.escribir("test", () -> {
            redis.opsForValue().set(CLAVE_PRUEBA, "ok", java.time.Duration.ofSeconds(30));
        });

        Optional<String> valor = soporte.leer("test", () -> redis.opsForValue().get(CLAVE_PRUEBA));
        assertThat(valor).contains("ok");
        Long ttl = redis.getExpire(CLAVE_PRUEBA);
        assertThat(ttl).isNotNull().isBetween(1L, 30L);
    }

    @Test
    @DisplayName("el repositorio de alertas actualiza el conteo en Redis real")
    void alertas_actualizaConteoReal() {
        AlertaRedisRepository alertas = new AlertaRedisRepository(soporte);
        alertas.marcarActiva(101L);
        alertas.marcarActiva(102L);
        assertThat(alertas.contarAbiertas()).contains(2L);

        alertas.marcarResuelta(101L);
        assertThat(alertas.contarAbiertas()).contains(1L);
    }

    @Test
    @DisplayName("el estado de sensor se guarda con TTL de 5 minutos en Redis real")
    void estadoSensor_guardaConTtl() {
        EstadoSensorRedisRepository repo =
                new EstadoSensorRedisRepository(soporte, 300);
        com.museosmart.entity.Sensor sensor = new com.museosmart.entity.Sensor();
        setField(sensor, "id", 999L);
        sensor.setCodigo("SENSOR-TEST-IT");
        sensor.setCategoria("AMBIENTAL");

        repo.guardarAmbiental(sensor, 21.5, 48.0, 180.0,
                OffsetDateTime.parse("2026-11-04T20:00:00Z"), "PENDIENTE");

        Optional<EstadoSensorRedis> estado = repo.obtener("SENSOR-TEST-IT");
        assertThat(estado).isPresent();
        assertThat(estado.get().temperatura()).isEqualTo(21.5);
        Long ttl = redis.getExpire(RedisClaves.sensor("SENSOR-TEST-IT"));
        assertThat(ttl).isNotNull().isBetween(1L, 300L);

        redis.delete(RedisClaves.sensor("SENSOR-TEST-IT"));
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
