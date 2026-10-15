package com.museosmart.iot.influx;

import com.museosmart.entity.MedicionPendiente;
import com.museosmart.iot.IotInfluxProperties;
import com.museosmart.repository.MedicionPendienteRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Drena el outbox {@code medicion_pendiente} hacia InfluxDB.
 *
 * <p>Diseno tolerante a fallos:
 * <ul>
 *   <li>Si InfluxDB no esta disponible, cada medicion incrementa {@code intentos}
 *       y se reprograma con {@code proximo_intento_en}; nunca se pierde.</li>
 *   <li>Al superar {@code maxIntentos} la medicion pasa a ERROR (deja de
 *       reintentarse, pero queda registrada y visible).</li>
 *   <li>Al recuperar InfluxDB, el barrido vuelve a drenar las PENDIENTES.</li>
 * </ul>
 * Cada medicion se procesa en su propia transaccion (ver
 * {@link MedicionEnvioService}) para que un fallo de red no revierta el lote.</p>
 */
@Component
public class OutboxDrenadorInflux {

    private static final Logger log = LoggerFactory.getLogger(OutboxDrenadorInflux.class);

    private final MedicionPendienteRepository repository;
    private final InfluxEscritor escritor;
    private final MedicionEnvioService envioService;
    private final IotInfluxProperties propiedades;

    public OutboxDrenadorInflux(MedicionPendienteRepository repository,
                                InfluxEscritor escritor,
                                MedicionEnvioService envioService,
                                IotInfluxProperties propiedades) {
        this.repository = repository;
        this.escritor = escritor;
        this.envioService = envioService;
        this.propiedades = propiedades;
    }

    @Scheduled(fixedDelayString = "${app.iot.influx.intervalo-ms:15000}")
    public void drenar() {
        if (!escritor.habilitado()) {
            return;
        }
        List<MedicionPendiente> lote = repository.buscarPendientes(
                OffsetDateTime.now(), PageRequest.of(0, propiedades.getLote()));
        if (lote.isEmpty()) {
            return;
        }
        log.debug("Drenando {} mediciones pendientes hacia InfluxDB", lote.size());
        for (MedicionPendiente medicion : lote) {
            envioService.procesar(medicion.getId());
        }
    }
}
