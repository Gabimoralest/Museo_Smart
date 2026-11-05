package com.museosmart.repository.redis;

import com.museosmart.entity.Alerta;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.Set;

/**
 * Repositorio Redis del conteo de alertas activas (ABIERTA/RECONOCIDA).
 *
 * <p>Mantiene un conjunto con los ids de las alertas activas. El conteo es
 * {@code SCARD}. Se actualiza al abrir o resolver una alerta. Sin TTL: refleja
 * el estado real mientras el proceso de alertas lo mantiene.</p>
 *
 * <p>Si Redis no esta disponible, las lecturas devuelven vacio y
 * {@code AlertaService} calcula el conteo desde PostgreSQL.</p>
 */
@Repository
public class AlertaRedisRepository {

    private final RedisSoporte soporte;

    public AlertaRedisRepository(RedisSoporte soporte) {
        this.soporte = soporte;
    }

    /** Registra una alerta como activa. */
    public void marcarActiva(Long alertaId) {
        if (alertaId == null) {
            return;
        }
        soporte.escribir("alertaActiva", () ->
                soporte.plantilla().opsForSet().add(RedisClaves.ALERTAS_ABIERTAS, String.valueOf(alertaId)));
    }

    /** Quita una alerta del conjunto de activas (resuelta). */
    public void marcarResuelta(Long alertaId) {
        if (alertaId == null) {
            return;
        }
        soporte.escribir("alertaResuelta", () ->
                soporte.plantilla().opsForSet().remove(RedisClaves.ALERTAS_ABIERTAS, String.valueOf(alertaId)));
    }

    /** Numero de alertas activas segun Redis. Vacio si Redis no responde. */
    public Optional<Long> contarAbiertas() {
        return soporte.leer("contarAlertas", () -> {
            Long total = soporte.plantilla().opsForSet().size(RedisClaves.ALERTAS_ABIERTAS);
            return total != null ? total : 0L;
        });
    }

    /** Ids de las alertas activas segun Redis. Vacio si Redis no responde. */
    public Optional<Set<String>> idsAbiertas() {
        return soporte.leer("idsAlertas", () ->
                soporte.plantilla().opsForSet().members(RedisClaves.ALERTAS_ABIERTAS));
    }

    /**
     * Sincroniza el conjunto con el estado real de la base: lo reemplaza por los
     * ids indicados. Se usa al arrancar o cuando Redis pierde el estado.
     */
    public void sincronizar(Iterable<Long> idsActivas) {
        soporte.escribir("sincronizarAlertas", () -> {
            StringRedisTemplate t = soporte.plantilla();
            t.delete(RedisClaves.ALERTAS_ABIERTAS);
            for (Long id : idsActivas) {
                if (id != null) {
                    t.opsForSet().add(RedisClaves.ALERTAS_ABIERTAS, String.valueOf(id));
                }
            }
        });
    }

    /** Indica si la alerta esta registrada como activa en Redis. */
    public Optional<Boolean> estaActiva(Long alertaId) {
        if (alertaId == null) {
            return Optional.empty();
        }
        return soporte.leer("alertaEstaActiva", () ->
                soporte.plantilla().opsForSet().isMember(
                        RedisClaves.ALERTAS_ABIERTAS, String.valueOf(alertaId)));
    }
}
