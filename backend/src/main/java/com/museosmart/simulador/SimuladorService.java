package com.museosmart.simulador;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.museosmart.entity.Sala;
import com.museosmart.entity.Sensor;
import com.museosmart.exception.RecursoNoEncontradoException;
import com.museosmart.exception.ReglaNegocioException;
import com.museosmart.repository.SalaRepository;
import com.museosmart.repository.SensorRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Gestiona los escenarios de demostracion enviando ordenes por MQTT al
 * simulador Node-RED.
 *
 * <p>No altera la logica de alertas, Redis ni InfluxDB: solo publica en el
 * topico de control. Node-RED decide como deformar los datos simulados y el
 * backend sigue procesando los mensajes como siempre.</p>
 */
@Service
@ConditionalOnProperty(name = "app.simulador.habilitado", havingValue = "true")
public class SimuladorService {

    private static final Logger log = LoggerFactory.getLogger(SimuladorService.class);

    private final SimuladorProperties propiedades;
    private final SimuladorPublicador publicador;
    private final SimuladorEstadoListener estadoListener;
    private final SalaRepository salaRepository;
    private final SensorRepository sensorRepository;
    private final ObjectMapper objectMapper;

    public SimuladorService(SimuladorProperties propiedades,
                            SimuladorPublicador publicador,
                            SimuladorEstadoListener estadoListener,
                            SalaRepository salaRepository,
                            SensorRepository sensorRepository,
                            ObjectMapper objectMapper) {
        this.propiedades = propiedades;
        this.publicador = publicador;
        this.estadoListener = estadoListener;
        this.salaRepository = salaRepository;
        this.sensorRepository = sensorRepository;
        this.objectMapper = objectMapper;
    }

    public SimuladorEstadoResponse estado() {
        return estadoListener.estado();
    }

    /**
     * Activa un escenario.
     *
     * @param actor correo del administrador que lo activo (se registra en log)
     */
    public SimuladorEstadoResponse activar(EscenarioRequest request, String actor) {
        TipoEscenario tipo = TipoEscenario.desde(request.tipo());
        if (tipo == null) {
            throw new ReglaNegocioException("Tipo de escenario invalido: " + request.tipo());
        }

        Map<String, Object> orden = new LinkedHashMap<>();
        orden.put("tipo", tipo.name());

        if (tipo == TipoEscenario.SENSOR_DESCONECTADO) {
            Sensor sensor = resolverSensor(request.sensorCodigo());
            orden.put("sensorCodigo", sensor.getCodigo());
            log.info("Simulador: escenario {} sobre {} solicitado por {}",
                    tipo, sensor.getCodigo(), actor);
        } else {
            Sala sala = resolverSala(request.sala());
            orden.put("sala", sala.getCodigo3d());
            log.info("Simulador: escenario {} sobre {} ({}) solicitado por {}",
                    tipo, sala.getCodigo3d(), sala.getNombre(), actor);
        }

        publicar(propiedades.getTopicoControl(), orden);
        return estado();
    }

    /** Restablece una sala (o todos los escenarios). */
    public SimuladorEstadoResponse restablecer(RestablecerRequest request, String actor) {
        Map<String, Object> orden = new LinkedHashMap<>();
        orden.put("tipo", "RESTABLECER");
        if (Boolean.TRUE.equals(request.todo())) {
            orden.put("todo", true);
            log.info("Simulador: RESTABLECER todo solicitado por {}", actor);
        } else {
            if (request.sensorCodigo() != null && !request.sensorCodigo().isBlank()) {
                Sensor sensor = resolverSensor(request.sensorCodigo());
                orden.put("sensorCodigo", sensor.getCodigo());
                log.info("Simulador: RESTABLECER sensor {} solicitado por {}", sensor.getCodigo(), actor);
            } else if (request.sala() != null && !request.sala().isBlank()) {
                Sala sala = resolverSala(request.sala());
                orden.put("sala", sala.getCodigo3d());
                log.info("Simulador: RESTABLECER {} ({}) solicitado por {}",
                        sala.getCodigo3d(), sala.getNombre(), actor);
            } else {
                throw new ReglaNegocioException("Indica una sala, un sensor o usa todo=true");
            }
        }
        publicar(propiedades.getTopicoControl(), orden);
        return estado();
    }

    /** Activa o desactiva el horario de visita forzado. */
    public SimuladorEstadoResponse horarioForzado(boolean activo, String actor) {
        Map<String, Object> orden = new LinkedHashMap<>();
        orden.put("tipo", "HORARIO_FORZADO");
        orden.put("activo", activo);
        log.info("Simulador: horario forzado {} solicitado por {}", activo ? "ON" : "OFF", actor);
        publicar(propiedades.getTopicoHorario(), orden);
        return estado();
    }

    private void publicar(String topico, Map<String, Object> orden) {
        try {
            publicador.publicar(topico, objectMapper.writeValueAsString(orden), false);
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new ReglaNegocioException("No se pudo serializar la orden del simulador");
        }
    }

    /**
     * Resuelve la sala por id real o codigo 3D. Se acepta tambien el nombre
     * exacto para facilitar las pruebas manuales.
     */
    private Sala resolverSala(String referencia) {
        if (referencia == null || referencia.isBlank()) {
            throw new ReglaNegocioException("La sala es obligatoria para este escenario");
        }
        String valor = referencia.trim();
        List<Sala> salas = salaRepository.findAllByOrderByOrdenAsc();

        if (valor.matches("\\d+")) {
            long id = Long.parseLong(valor);
            for (Sala s : salas) {
                if (s.getId() != null && s.getId() == id) {
                    return s;
                }
            }
        }
        for (Sala s : salas) {
            if (s.getCodigo3d() != null && s.getCodigo3d().equalsIgnoreCase(valor)) {
                return s;
            }
        }
        for (Sala s : salas) {
            if (s.getNombre() != null && s.getNombre().equalsIgnoreCase(valor)) {
                return s;
            }
        }
        throw new RecursoNoEncontradoException("No existe la sala '" + referencia + "'");
    }

    private Sensor resolverSensor(String codigo) {
        if (codigo == null || codigo.isBlank()) {
            throw new ReglaNegocioException("El codigo de sensor es obligatorio para SENSOR_DESCONECTADO");
        }
        return sensorRepository.findByCodigo(codigo.trim())
                .orElseThrow(() -> new RecursoNoEncontradoException(
                        "No existe el sensor '" + codigo + "'"));
    }
}
