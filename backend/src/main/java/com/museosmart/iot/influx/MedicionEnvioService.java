package com.museosmart.iot.influx;

import com.museosmart.entity.MedicionPendiente;
import com.museosmart.iot.IotInfluxProperties;
import com.museosmart.repository.MedicionPendienteRepository;
import com.museosmart.repository.redis.EstadoSensorRedisRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

/**
 * Envio transaccional de UNA medicion del outbox hacia InfluxDB.
 *
 * <p>Se separa del planificador para que cada intento se confirme en su propia
 * transaccion ({@link Propagation#REQUIRES_NEW}); asi un fallo de red en una
 * medicion no revierte el estado ya confirmado de las demas.</p>
 */
@Service
public class MedicionEnvioService {

    private static final Logger log = LoggerFactory.getLogger(MedicionEnvioService.class);

    private final MedicionPendienteRepository repository;
    private final InfluxEscritor escritor;
    private final IotInfluxProperties propiedades;
    private final EstadoSensorRedisRepository estadoSensorRedis;

    public MedicionEnvioService(MedicionPendienteRepository repository,
                                InfluxEscritor escritor,
                                IotInfluxProperties propiedades,
                                EstadoSensorRedisRepository estadoSensorRedis) {
        this.repository = repository;
        this.escritor = escritor;
        this.propiedades = propiedades;
        this.estadoSensorRedis = estadoSensorRedis;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void procesar(Long id) {
        MedicionPendiente medicion = repository.findById(id).orElse(null);
        if (medicion == null || !"PENDIENTE".equals(medicion.getEstado())) {
            return;
        }
        try {
            escritor.escribir(medicion);
            medicion.setEstado("ENVIADO");
            medicion.setEnviadoEn(OffsetDateTime.now());
            medicion.setUltimoError(null);
            medicion.setProximoIntentoEn(null);
            repository.save(medicion);
            sincronizarEstadoRedis(medicion, "ENVIADO");
        } catch (RuntimeException ex) {
            int intentos = medicion.getIntentos() + 1;
            medicion.setIntentos(intentos);
            medicion.setUltimoError(recortar(ex.getMessage()));
            if (intentos >= propiedades.getMaxIntentos()) {
                medicion.setEstado("ERROR");
                medicion.setProximoIntentoEn(null);
                log.warn("Medicion {} marcada ERROR tras {} intentos", id, intentos);
            } else {
                medicion.setProximoIntentoEn(
                        OffsetDateTime.now().plusSeconds(propiedades.getReintentoSegundos()));
                log.debug("Medicion {} fallo (intento {}); se reintentara", id, intentos);
            }
            repository.save(medicion);
            sincronizarEstadoRedis(medicion, medicion.getEstado());
        }
    }

    /**
     * Mantiene el estado del outbox en el hash de Redis de la ultima lectura,
     * de modo que el panel (que lee Redis) muestre el mismo estado que
     * PostgreSQL. Es un extra tolerante: si Redis falla, no afecta al drenado.
     */
    private void sincronizarEstadoRedis(MedicionPendiente medicion, String estado) {
        if (medicion.getSensor() == null || medicion.getSensor().getCodigo() == null) {
            return;
        }
        estadoSensorRedis.actualizarEstado(
                medicion.getSensor().getCodigo(), medicion.getMetrica(),
                medicion.getMedidoEn(), estado);
    }

    private String recortar(String texto) {
        if (texto == null) {
            return null;
        }
        return texto.length() <= 2000 ? texto : texto.substring(0, 2000);
    }
}
