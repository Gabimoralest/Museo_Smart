package com.museosmart.iot.influx;

import com.influxdb.client.InfluxDBClient;
import com.influxdb.client.InfluxDBClientFactory;
import com.influxdb.query.FluxRecord;
import com.influxdb.query.FluxTable;
import com.museosmart.iot.IotInfluxProperties;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Lector de SOLO CONSULTA de InfluxDB 2.x para el histórico de mediciones.
 *
 * <p>Reutiliza la configuración existente ({@link IotInfluxProperties}: url, org,
 * token, bucket) y el mismo patrón de cliente perezoso que el escritor, sin
 * tocar el proceso de escritura ni el outbox.</p>
 *
 * <p>El esquema real (ver {@link InfluxEscritor}) es: measurement = nombre de la
 * métrica (TEMPERATURA/HUMEDAD/LUZ/PRESENCIA); tag {@code sensor} (código),
 * tag {@code metrica} y tag {@code unidad}; field {@code valor} (float); tiempo
 * en milisegundos.</p>
 */
@Component
public class InfluxLector {

    private static final Logger log = LoggerFactory.getLogger(InfluxLector.class);

    private final IotInfluxProperties propiedades;
    private volatile InfluxDBClient client;

    public InfluxLector(IotInfluxProperties propiedades) {
        this.propiedades = propiedades;
    }

    /** Indica si hay configuración suficiente para intentar consultar. */
    public boolean habilitado() {
        return propiedades.configurado();
    }

    /** Bucket configurado (para construir consultas Flux con el mismo destino). */
    public String getBucket() {
        return propiedades.getBucket();
    }

    /**
     * Ejecuta una consulta Flux y devuelve las filas agrupadas por tag
     * {@code sensor}. Cada serie conserva el orden temporal ascendente.
     *
     * @param fluxQuery consulta Flux ya construida y validada por el llamador.
     * @return mapa sensor -> lista de (tiempo, valor) ordenados por tiempo.
     */
    public Map<String, List<Punto>> consultarSeries(String fluxQuery) {
        List<FluxTable> tablas = cliente().getQueryApi().query(fluxQuery, propiedades.getOrg());
        Map<String, List<Punto>> series = new LinkedHashMap<>();
        for (FluxTable tabla : tablas) {
            for (FluxRecord fila : tabla.getRecords()) {
                Instant tiempo = fila.getTime();
                Object valor = fila.getValue();
                if (tiempo == null || !(valor instanceof Number numero)) {
                    continue;
                }
                Object sensor = fila.getValueByKey("sensor");
                String clave = sensor != null ? sensor.toString() : "(sin sensor)";
                series.computeIfAbsent(clave, k -> new ArrayList<>())
                        .add(new Punto(tiempo, numero.doubleValue()));
            }
        }
        series.values().forEach(lista -> lista.sort((a, b) -> a.tiempo().compareTo(b.tiempo())));
        return series;
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
                    log.info("Cliente InfluxDB (lectura) creado hacia {}", propiedades.getUrl());
                }
            }
        }
        return actual;
    }

    @PreDestroy
    public void cerrar() {
        InfluxDBClient actual = client;
        if (actual != null) {
            try {
                actual.close();
            } catch (RuntimeException ex) {
                log.warn("Error cerrando cliente InfluxDB (lectura)", ex);
            }
        }
    }

    /** Punto de una serie temporal. */
    public record Punto(Instant tiempo, double valor) {
    }
}
