package com.museosmart.iot.influx;

import com.museosmart.entity.MedicionPendiente;
import com.museosmart.iot.IotInfluxProperties;
import com.museosmart.repository.MedicionPendienteRepository;
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

    public MedicionEnvioService(MedicionPendienteRepository repository,
                                InfluxEscritor escritor,
                                IotInfluxProperties propiedades) {
        this.repository = repository;
        this.escritor = escritor;
        this.propiedades = propiedades;
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
        }
    }

    private String recortar(String texto) {
        if (texto == null) {
            return null;
        }
        return texto.length() <= 2000 ? texto : texto.substring(0, 2000);
    }
}
