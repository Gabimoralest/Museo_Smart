package com.museosmart.iot.influx;

import com.influxdb.client.InfluxDBClient;
import com.influxdb.client.InfluxDBClientFactory;
import com.influxdb.client.domain.WritePrecision;
import com.influxdb.client.write.Point;
import com.museosmart.entity.MedicionPendiente;
import com.museosmart.iot.IotInfluxProperties;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Escribe mediciones en InfluxDB 2.x.
 *
 * <p>El cliente se crea de forma perezosa: si InfluxDB no esta disponible al
 * arrancar, la aplicacion no falla; simplemente el drenado se reintentara. El
 * bean puede existir sin conexion.</p>
 */
@Component
public class InfluxEscritor {

    private static final Logger log = LoggerFactory.getLogger(InfluxEscritor.class);

    private final IotInfluxProperties propiedades;
    private volatile InfluxDBClient client;

    public InfluxEscritor(IotInfluxProperties propiedades) {
        this.propiedades = propiedades;
    }

    /** Indica si hay configuracion suficiente para intentar escribir. */
    public boolean habilitado() {
        return propiedades.configurado();
    }

    /**
     * Escribe una medicion. Lanza excepcion si la escritura falla, para que el
     * drenador pueda programar el reintento sin perder el dato.
     */
    public void escribir(MedicionPendiente medicion) {
        InfluxDBClient c = cliente();
        Point punto = Point.measurement(medicion.getMetrica())
                .addTag("sensor", codigoSensor(medicion))
                .addTag("metrica", medicion.getMetrica())
                .addField("valor", medicion.getValor().doubleValue())
                .time(medicion.getMedidoEn().toInstant(), WritePrecision.MS);
        if (medicion.getUnidad() != null) {
            punto.addTag("unidad", medicion.getUnidad());
        }
        c.getWriteApiBlocking().writePoint(propiedades.getBucket(), propiedades.getOrg(), punto);
    }

    private String codigoSensor(MedicionPendiente medicion) {
        if (medicion.getSensor() != null) {
            return medicion.getSensor().getCodigo();
        }
        // Fallback: el mensaje crudo conserva el codigo del sensor.
        String codigo = medicion.getMensajeIot() != null ? medicion.getMensajeIot().getSensorCodigo() : null;
        return codigo != null ? codigo : "desconocido";
    }

    private InfluxDBClient cliente() {
        InfluxDBClient actual = client;
        if (actual == null) {
            synchronized (this) {
                actual = client;
                if (actual == null) {
                    actual = InfluxDBClientFactory.create(
                            propiedades.getUrl(),
                            propiedades.getToken().toCharArray(),
                            propiedades.getOrg(),
                            propiedades.getBucket());
                    client = actual;
                    log.info("Cliente InfluxDB creado hacia {}", propiedades.getUrl());
                }
            }
        }
        return actual;
    }

    /** Marca de tiempo para trazabilidad (no usada directamente aqui). */
    static Instant ahora() {
        return Instant.now();
    }

    @PreDestroy
    public void cerrar() {
        InfluxDBClient actual = client;
        if (actual != null) {
            try {
                actual.close();
            } catch (RuntimeException ex) {
                log.warn("Error cerrando cliente InfluxDB", ex);
            }
        }
    }
}
