package com.museosmart.repository.redis;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;

/**
 * Acceso tolerante a Redis.
 *
 * <p>Redis es una capa VOLATIL de estado actual. Si no esta disponible (caido,
 * lento o mal configurado), la aplicacion debe seguir funcionando leyendo de
 * PostgreSQL. Por eso todas las operaciones pasan por aqui y cualquier fallo
 * se traduce en {@code Optional.empty()} / no-op, registrando como maximo un
 * aviso por minuto (sin inundar el log ni propagar el error al usuario).</p>
 */
@Component
public class RedisSoporte {

    private static final Logger log = LoggerFactory.getLogger(RedisSoporte.class);
    private static final long INTERVALO_AVISO_MS = 60_000L;

    private final StringRedisTemplate redis;
    private final boolean habilitado;
    private final AtomicLong ultimoAviso = new AtomicLong(0);
    private volatile boolean avisoPendiente = true;

    public RedisSoporte(StringRedisTemplate redis,
                        @Value("${app.redis.enabled:true}") boolean habilitado) {
        this.redis = redis;
        this.habilitado = habilitado;
    }

    /** Plantilla subyacente (puede ser null si Redis esta deshabilitado). */
    public StringRedisTemplate plantilla() {
        return habilitado ? redis : null;
    }

    public boolean habilitado() {
        return habilitado;
    }

    /**
     * Ejecuta una operacion de lectura. Devuelve vacio si Redis esta
     * deshabilitado, no responde o la operacion falla.
     */
    public <T> Optional<T> leer(String operacion, Supplier<T> accion) {
        if (!habilitado || accion == null) {
            return Optional.empty();
        }
        try {
            T valor = accion.get();
            avisoPendiente = true;
            return Optional.ofNullable(valor);
        } catch (RuntimeException ex) {
            registrarFallo(operacion, ex);
            return Optional.empty();
        }
    }

    /** Ejecuta una escritura; un fallo nunca se propaga al llamador. */
    public void escribir(String operacion, Runnable accion) {
        if (!habilitado || accion == null) {
            return;
        }
        try {
            accion.run();
            avisoPendiente = true;
        } catch (RuntimeException ex) {
            registrarFallo(operacion, ex);
        }
    }

    private void registrarFallo(String operacion, RuntimeException ex) {
        long ahora = System.currentTimeMillis();
        long anterior = ultimoAviso.get();
        if (avisoPendiente || ahora - anterior >= INTERVALO_AVISO_MS) {
            ultimoAviso.set(ahora);
            avisoPendiente = false;
            log.warn("Redis no disponible en '{}' ({}). Se usa PostgreSQL como respaldo.",
                    operacion, ex.getClass().getSimpleName());
        }
    }
}
