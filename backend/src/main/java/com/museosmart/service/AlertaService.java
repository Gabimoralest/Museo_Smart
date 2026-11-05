package com.museosmart.service;

import com.museosmart.entity.Alerta;
import com.museosmart.entity.Exhibicion;
import com.museosmart.entity.Sensor;
import com.museosmart.repository.AlertaRepository;
import com.museosmart.repository.ExhibicionRepository;
import com.museosmart.repository.redis.AlertaRedisRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Gestion de alertas ambientales.
 *
 * <p>Evalua una medicion contra los limites de la exhibicion a la que pertenece
 * la sala del sensor. Si se supera un limite, abre una alerta (deduplicada por
 * condicion); si vuelve a rango, resuelve la alerta activa correspondiente.</p>
 *
 * <p>Las alertas de la misma condicion no se duplican mientras permanecen
 * ABIERTAS/RECONOCIDAS (indice unico parcial). Por eso se busca primero.</p>
 */
@Service
public class AlertaService {

    private static final Logger log = LoggerFactory.getLogger(AlertaService.class);
    private static final List<String> ACTIVAS = List.of(Alerta.ESTADO_ABIERTA, Alerta.ESTADO_RECONOCIDA);

    private final AlertaRepository alertaRepository;
    private final ExhibicionRepository exhibicionRepository;
    private final AlertaRedisRepository alertaRedis;

    public AlertaService(AlertaRepository alertaRepository, ExhibicionRepository exhibicionRepository,
                         AlertaRedisRepository alertaRedis) {
        this.alertaRepository = alertaRepository;
        this.exhibicionRepository = exhibicionRepository;
        this.alertaRedis = alertaRedis;
    }

    /**
     * Evalua una medicion ambiental individual.
     *
     * @param sensor     sensor ambiental (debe tener sala con exhibiciones)
     * @param metrica    TEMPERATURA, HUMEDAD o LUZ
     * @param valor      valor medido
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void evaluarAmbiental(Sensor sensor, String metrica, double valor) {
        if (sensor == null || sensor.getSala() == null) {
            return;
        }
        // Limites: se toman del extremo mas permisivo entre las exhibiciones de
        // la sala, para no alertar por una sola exhibicion con limites estrechos.
        BigDecimal min = null;
        BigDecimal max = null;
        for (Exhibicion e : exhibicionRepository.findBySalaIdAndActiva(sensor.getSala().getId(), true)) {
            if ("TEMPERATURA".equals(metrica)) {
                min = max(min, e.getTempMinC(), true);
                max = max(max, e.getTempMaxC(), false);
            } else if ("HUMEDAD".equals(metrica)) {
                min = max(min, e.getHumedadMinPct(), true);
                max = max(max, e.getHumedadMaxPct(), false);
            } else if ("LUZ".equals(metrica)) {
                max = max(max, e.getLuzMaxLux(), false);
            }
        }
        if (min == null && max == null) {
            return; // sin limites configurados: nada que evaluar
        }

        String condicion = "AMBIENTAL_" + metrica;
        BigDecimal v = BigDecimal.valueOf(valor);
        boolean fueraRango = (min != null && v.compareTo(min) < 0) || (max != null && v.compareTo(max) > 0);

        final BigDecimal minFinal = min;
        final BigDecimal maxFinal = max;
        if (fueraRango) {
            alertaRepository.findBySensorIdAndCondicionClaveAndEstadoIn(sensor.getId(), condicion, ACTIVAS)
                    .ifPresentOrElse(
                            a -> log.debug("Alerta {} ya activa para sensor {}", condicion, sensor.getCodigo()),
                            () -> abrir(sensor, condicion, metrica, valor, minFinal, maxFinal));
        } else {
            alertaRepository.findBySensorIdAndCondicionClaveAndEstadoIn(sensor.getId(), condicion, ACTIVAS)
                    .ifPresent(this::resolver);
        }
    }

    private void abrir(Sensor sensor, String condicion, String metrica, double valor,
                       BigDecimal min, BigDecimal max) {
        Alerta alerta = new Alerta();
        alerta.setSensor(sensor);
        alerta.setTipo("AMBIENTAL");
        alerta.setSeveridad("ADVERTENCIA");
        alerta.setEstado(Alerta.ESTADO_ABIERTA);
        alerta.setCondicionClave(condicion);
        alerta.setDescripcion(String.format(
                "%s fuera de rango en el sensor %s: %.2f (min=%s, max=%s)",
                metrica, sensor.getCodigo(), valor,
                min != null ? min.toPlainString() : "-",
                max != null ? max.toPlainString() : "-"));
        alertaRepository.save(alerta);
        log.info("Alerta AMBIENTAL abierta para {} ({})", sensor.getCodigo(), metrica);
        sincronizarRedisTrasCommit(alerta, true);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void resolver(Alerta alerta) {
        alerta.setEstado(Alerta.ESTADO_RESUELTA);
        alerta.setResueltaEn(OffsetDateTime.now());
        alertaRepository.save(alerta);
        sincronizarRedisTrasCommit(alerta, false);
    }

    @Transactional(readOnly = true)
    public List<Alerta> listarActivas() {
        return alertaRepository.findByEstadoInOrderByIniciadaEnDesc(ACTIVAS);
    }

    @Transactional(readOnly = true)
    public List<Alerta> listarTodas() {
        return alertaRepository.findAllByOrderByIniciadaEnDesc();
    }

    @Transactional
    public Alerta resolverPorId(Long id) {
        Alerta alerta = alertaRepository.findById(id)
                .orElseThrow(() -> new com.museosmart.exception.RecursoNoEncontradoException(
                        "No existe la alerta con id " + id));
        if (Alerta.ESTADO_ABIERTA.equals(alerta.getEstado())
                || Alerta.ESTADO_RECONOCIDA.equals(alerta.getEstado())) {
            resolver(alerta);
        }
        return alerta;
    }
    private static BigDecimal max(BigDecimal actual, BigDecimal candidato, boolean minimo) {
        if (candidato == null) {
            return actual;
        }
        if (actual == null) {
            return candidato;
        }
        if (minimo) {
            return candidato.compareTo(actual) < 0 ? candidato : actual; // el menor de los minimos
        }
        return candidato.compareTo(actual) > 0 ? candidato : actual; // el mayor de los maximos
    }

    /**
     * Numero de alertas activas (ABIERTA/RECONOCIDA). Lee de Redis; si Redis no
     * responde, lo cuenta en PostgreSQL. Es el dato de la campana del panel.
     */
    @Transactional(readOnly = true)
    public long contarAbiertas() {
        return alertaRedis.contarAbiertas()
                .orElseGet(() -> alertaRepository.countByEstado(Alerta.ESTADO_ABIERTA)
                        + alertaRepository.countByEstado(Alerta.ESTADO_RECONOCIDA));
    }

    /**
     * Mantiene el conjunto de alertas activas de Redis tras confirmar la
     * transaccion (nunca refleja una alerta que la base revirtio).
     */
    private void sincronizarRedisTrasCommit(Alerta alerta, boolean activa) {
        Runnable accion = () -> {
            if (activa) {
                alertaRedis.marcarActiva(alerta.getId());
            } else {
                alertaRedis.marcarResuelta(alerta.getId());
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    accion.run();
                }
            });
        } else {
            accion.run();
        }
    }
}
