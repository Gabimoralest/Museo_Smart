package com.museosmart.repository.redis;

import com.museosmart.entity.Sensor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Repositorio Redis del ESTADO ACTUAL de los sensores.
 *
 * <p>Guarda, por cada sensor, un hash con su ultima lectura y metadatos de
 * ubicacion. TTL configurable (por defecto 5 minutos): si el sensor deja de
 * enviar, su estado expira y el panel lo muestra como "sin datos recientes".
 * PostgreSQL conserva el historico completo; Redis solo acelera el "ahora".</p>
 *
 * <p>Todas las operaciones son tolerantes a fallos ({@link RedisSoporte}): si
 * Redis no responde, las lecturas devuelven vacio y los servicios caen a
 * PostgreSQL.</p>
 */
@Repository
public class EstadoSensorRedisRepository {

    public static final String METRICA_TEMPERATURA = "t";
    public static final String METRICA_HUMEDAD = "h";
    public static final String METRICA_LUZ = "l";
    public static final String METRICA_PRESENCIA = "p";

    private static final String CAMPO_ID = "sensorId";
    private static final String CAMPO_CODIGO = "sensorCodigo";
    private static final String CAMPO_CATEGORIA = "categoria";
    private static final String CAMPO_SALA = "salaId";
    private static final String CAMPO_EXHIBICION = "exhibicionId";
    private static final String CAMPO_ACTUALIZADO = "actualizadoEn";
    private static final String SUFIJO_VALOR = ".valor";
    private static final String SUFIJO_UNIDAD = ".unidad";
    private static final String SUFIJO_MEDIDO = ".medidoEn";
    private static final String SUFIJO_ESTADO = ".estado";

    private final RedisSoporte soporte;
    private final Duration ttl;

    public EstadoSensorRedisRepository(
            RedisSoporte soporte,
            @Value("${app.redis.ttl-estado-sensor-segundos:300}") long ttlSegundos) {
        this.soporte = soporte;
        this.ttl = Duration.ofSeconds(ttlSegundos);
    }

    /** Guarda la ultima lectura ambiental del sensor (temperatura, humedad, luz). */
    public void guardarAmbiental(Sensor sensor, double temperatura, double humedad,
                                 double luminosidad, OffsetDateTime medidoEn, String estado) {
        if (sensor == null || sensor.getCodigo() == null) {
            return;
        }
        String clave = RedisClaves.sensor(sensor.getCodigo());
        soporte.escribir("guardarAmbiental", () -> {
            StringRedisTemplate t = soporte.plantilla();
            Map<String, String> campos = base(sensor, medidoEn);
            campos.put(METRICA_TEMPERATURA + SUFIJO_VALOR, valor(temperatura));
            campos.put(METRICA_TEMPERATURA + SUFIJO_UNIDAD, "C");
            campos.put(METRICA_TEMPERATURA + SUFIJO_MEDIDO, medidoEn.toString());
            campos.put(METRICA_TEMPERATURA + SUFIJO_ESTADO, estado);
            campos.put(METRICA_HUMEDAD + SUFIJO_VALOR, valor(humedad));
            campos.put(METRICA_HUMEDAD + SUFIJO_UNIDAD, "%");
            campos.put(METRICA_HUMEDAD + SUFIJO_MEDIDO, medidoEn.toString());
            campos.put(METRICA_HUMEDAD + SUFIJO_ESTADO, estado);
            campos.put(METRICA_LUZ + SUFIJO_VALOR, valor(luminosidad));
            campos.put(METRICA_LUZ + SUFIJO_UNIDAD, "lux");
            campos.put(METRICA_LUZ + SUFIJO_MEDIDO, medidoEn.toString());
            campos.put(METRICA_LUZ + SUFIJO_ESTADO, estado);
            t.opsForHash().putAll(clave, campos);
            t.expire(clave, ttl);
            t.opsForSet().add(RedisClaves.INDICE_SENSORES, sensor.getCodigo());
            t.expire(RedisClaves.INDICE_SENSORES, ttl.multipliedBy(3));

            if (sensor.getSala() != null) {
                String claveSala = RedisClaves.sala(sensor.getSala().getId());
                Map<String, String> sala = new java.util.HashMap<>();
                sala.put(CAMPO_CODIGO, sensor.getCodigo());
                sala.put("temperatura", valor(temperatura));
                sala.put("humedad", valor(humedad));
                sala.put("luminosidad", valor(luminosidad));
                sala.put(CAMPO_ACTUALIZADO, medidoEn.toString());
                t.opsForHash().putAll(claveSala, sala);
                t.expire(claveSala, ttl);
            }
        });
    }

    /** Guarda la ultima lectura de presencia del sensor. */
    public void guardarPresencia(Sensor sensor, boolean presencia,
                                 OffsetDateTime medidoEn, String estado) {
        if (sensor == null || sensor.getCodigo() == null) {
            return;
        }
        String clave = RedisClaves.sensor(sensor.getCodigo());
        String val = presencia ? "1" : "0";
        soporte.escribir("guardarPresencia", () -> {
            StringRedisTemplate t = soporte.plantilla();
            Map<String, String> campos = base(sensor, medidoEn);
            campos.put(METRICA_PRESENCIA + SUFIJO_VALOR, val);
            campos.put(METRICA_PRESENCIA + SUFIJO_UNIDAD, "");
            campos.put(METRICA_PRESENCIA + SUFIJO_MEDIDO, medidoEn.toString());
            campos.put(METRICA_PRESENCIA + SUFIJO_ESTADO, estado);
            t.opsForHash().putAll(clave, campos);
            t.expire(clave, ttl);
            t.opsForSet().add(RedisClaves.INDICE_SENSORES, sensor.getCodigo());
            t.expire(RedisClaves.INDICE_SENSORES, ttl.multipliedBy(3));

            if (sensor.getExhibicion() != null) {
                String claveExh = RedisClaves.presenciaExhibicion(sensor.getExhibicion().getId());
                Map<String, String> exh = new java.util.HashMap<>();
                exh.put("exhibicionId", String.valueOf(sensor.getExhibicion().getId()));
                exh.put("sensorCodigo", sensor.getCodigo());
                exh.put("presencia", val);
                exh.put(CAMPO_ACTUALIZADO, medidoEn.toString());
                t.opsForHash().putAll(claveExh, exh);
                t.expire(claveExh, ttl);
            }
        });
    }

    /**
     * Actualiza solo el estado del outbox (PENDIENTE/ENVIADO/ERROR) de la ultima
     * lectura de una metrica, de modo que el panel siga mostrando el mismo dato
     * que PostgreSQL. Solo actua si la marca temporal coincide con la que origino
     * la medicion (evita pisar una lectura mas reciente).
     */
    public void actualizarEstado(String sensorCodigo, String metrica,
                                 OffsetDateTime medidoEn, String estado) {
        if (sensorCodigo == null || metrica == null || medidoEn == null) {
            return;
        }
        String prefijo = prefijo(metrica);
        if (prefijo == null) {
            return;
        }
        String clave = RedisClaves.sensor(sensorCodigo);
        soporte.escribir("actualizarEstado", () -> {
            StringRedisTemplate t = soporte.plantilla();
            Object guardado = t.opsForHash().get(clave, prefijo + SUFIJO_MEDIDO);
            if (guardado == null || !medidoEn.toString().equals(guardado.toString())) {
                return;
            }
            t.opsForHash().put(clave, prefijo + SUFIJO_ESTADO, estado);
            Long restante = t.getExpire(clave);
            if (restante != null && restante > 0) {
                t.expire(clave, Duration.ofSeconds(restante));
            }
        });
    }

    /** Lee el estado actual de un sensor desde Redis. */
    public Optional<EstadoSensorRedis> obtener(String sensorCodigo) {
        if (sensorCodigo == null) {
            return Optional.empty();
        }
        String clave = RedisClaves.sensor(sensorCodigo);
        return soporte.leer("obtenerSensor", () -> {
            Map<Object, Object> hash = soporte.plantilla().opsForHash().entries(clave);
            return hash.isEmpty() ? null : convertir(hash);
        });
    }

    /**
     * Lee todos los estados de sensor vigentes. Devuelve vacio si Redis no esta
     * disponible (para que el llamador use PostgreSQL).
     */
    public Optional<List<EstadoSensorRedis>> listarTodos() {
        if (!soporte.habilitado()) {
            return Optional.empty();
        }
        return soporte.leer("listarSensores", () -> {
            StringRedisTemplate t = soporte.plantilla();
            Set<String> codigos = t.opsForSet().members(RedisClaves.INDICE_SENSORES);
            List<EstadoSensorRedis> resultado = new ArrayList<>();
            if (codigos == null) {
                return resultado;
            }
            for (String codigo : new LinkedHashSet<>(codigos)) {
                Map<Object, Object> hash = t.opsForHash().entries(RedisClaves.sensor(codigo));
                if (!hash.isEmpty()) {
                    resultado.add(convertir(hash));
                }
            }
            return resultado;
        });
    }

    /** Lee el resumen ambiental actual de una sala. */
    public Optional<EstadoSalaRedis> obtenerSala(Long salaId) {
        if (salaId == null) {
            return Optional.empty();
        }
        String clave = RedisClaves.sala(salaId);
        return soporte.leer("obtenerSala", () -> {
            Map<Object, Object> hash = soporte.plantilla().opsForHash().entries(clave);
            if (hash.isEmpty()) {
                return null;
            }
            return new EstadoSalaRedis(
                    salaId,
                    texto(hash, CAMPO_CODIGO),
                    numero(hash, "temperatura"),
                    numero(hash, "humedad"),
                    numero(hash, "luminosidad"),
                    fecha(hash, CAMPO_ACTUALIZADO));
        });
    }

    private Map<String, String> base(Sensor sensor, OffsetDateTime medidoEn) {
        Map<String, String> campos = new java.util.HashMap<>();
        campos.put(CAMPO_ID, sensor.getId() != null ? String.valueOf(sensor.getId()) : "");
        campos.put(CAMPO_CODIGO, sensor.getCodigo());
        campos.put(CAMPO_CATEGORIA, sensor.getCategoria());
        campos.put(CAMPO_SALA, sensor.getSala() != null ? String.valueOf(sensor.getSala().getId()) : "");
        campos.put(CAMPO_EXHIBICION, sensor.getExhibicion() != null
                ? String.valueOf(sensor.getExhibicion().getId()) : "");
        campos.put(CAMPO_ACTUALIZADO, medidoEn.toString());
        return campos;
    }

    private EstadoSensorRedis convertir(Map<Object, Object> hash) {
        return new EstadoSensorRedis(
                largo(hash, CAMPO_ID),
                texto(hash, CAMPO_CODIGO),
                texto(hash, CAMPO_CATEGORIA),
                largo(hash, CAMPO_SALA),
                largo(hash, CAMPO_EXHIBICION),
                numero(hash, METRICA_TEMPERATURA + SUFIJO_VALOR),
                numero(hash, METRICA_HUMEDAD + SUFIJO_VALOR),
                numero(hash, METRICA_LUZ + SUFIJO_VALOR),
                booleano(hash, METRICA_PRESENCIA + SUFIJO_VALOR),
                texto(hash, METRICA_TEMPERATURA + SUFIJO_ESTADO),
                texto(hash, METRICA_HUMEDAD + SUFIJO_ESTADO),
                texto(hash, METRICA_LUZ + SUFIJO_ESTADO),
                texto(hash, METRICA_PRESENCIA + SUFIJO_ESTADO),
                fecha(hash, CAMPO_ACTUALIZADO));
    }

    private static String prefijo(String metrica) {
        return switch (metrica) {
            case "TEMPERATURA" -> METRICA_TEMPERATURA;
            case "HUMEDAD" -> METRICA_HUMEDAD;
            case "LUZ" -> METRICA_LUZ;
            case "PRESENCIA" -> METRICA_PRESENCIA;
            default -> null;
        };
    }

    private static String valor(double v) {
        return String.valueOf(v);
    }

    private static String texto(Map<Object, Object> hash, String campo) {
        Object v = hash.get(campo);
        return v != null ? v.toString() : null;
    }

    private static Long largo(Map<Object, Object> hash, String campo) {
        String v = texto(hash, campo);
        if (v == null || v.isBlank()) {
            return null;
        }
        try {
            return Long.valueOf(v);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static Double numero(Map<Object, Object> hash, String campo) {
        String v = texto(hash, campo);
        if (v == null || v.isBlank()) {
            return null;
        }
        try {
            return Double.valueOf(v);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static Boolean booleano(Map<Object, Object> hash, String campo) {
        String v = texto(hash, campo);
        if (v == null || v.isBlank()) {
            return null;
        }
        return "1".equals(v) || "true".equalsIgnoreCase(v);
    }

    private static OffsetDateTime fecha(Map<Object, Object> hash, String campo) {
        String v = texto(hash, campo);
        if (v == null || v.isBlank()) {
            return null;
        }
        try {
            return OffsetDateTime.parse(v);
        } catch (RuntimeException ex) {
            return null;
        }
    }
}
