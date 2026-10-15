package com.museosmart.controller;

import com.museosmart.dto.monitoreo.HistoricoResponse;
import com.museosmart.dto.monitoreo.LecturaResponse;
import com.museosmart.dto.monitoreo.ResumenMonitoreoResponse;
import com.museosmart.dto.monitoreo.SaludOutboxResponse;
import com.museosmart.dto.monitoreo.SensorMonitoreoResponse;
import com.museosmart.service.MonitoreoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Monitoreo IoT (lecturas recientes y resumen) desde PostgreSQL.
 * Requiere rol ADMIN o SUPERADMIN. Solo lectura: no altera el outbox.
 */
@RestController
@RequestMapping("/api/v1/admin/monitoreo")
@Tag(name = "Monitoreo IoT",
        description = "Lecturas recientes y resumen del monitoreo. Requiere rol ADMIN o SUPERADMIN.")
@SecurityRequirement(name = "bearerAuth")
public class MonitoreoController {

    private final MonitoreoService monitoreoService;

    public MonitoreoController(MonitoreoService monitoreoService) {
        this.monitoreoService = monitoreoService;
    }

    @GetMapping("/sensores")
    @Operation(summary = "Listar sensores con su ubicación y últimas lecturas",
            description = "Estado del dispositivo según la base de datos (no conectividad en vivo). "
                    + "Un sensor sin lecturas se marca tieneLecturas=false; no se infiere 'desconectado'.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Listado de sensores"),
            @ApiResponse(responseCode = "401", description = "No autenticado"),
            @ApiResponse(responseCode = "403", description = "Sin permisos o cambio de contraseña pendiente")
    })
    public ResponseEntity<List<SensorMonitoreoResponse>> sensores() {
        return ResponseEntity.ok(monitoreoService.listarSensores());
    }

    @GetMapping("/lecturas-recientes")
    @Operation(summary = "Últimas lecturas por sensor y métrica",
            description = "Última medición conocida de cada (sensor, métrica), ordenada por instante.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lecturas recientes"),
            @ApiResponse(responseCode = "401", description = "No autenticado"),
            @ApiResponse(responseCode = "403", description = "Sin permisos o cambio de contraseña pendiente")
    })
    public ResponseEntity<List<LecturaResponse>> lecturasRecientes() {
        return ResponseEntity.ok(monitoreoService.lecturasRecientes());
    }

    @GetMapping("/resumen")
    @Operation(summary = "Resumen del monitoreo",
            description = "Totales de sensores, promedios ambientales de la ventana reciente y "
                    + "presencia actual calculada con datos reales.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Resumen del monitoreo"),
            @ApiResponse(responseCode = "401", description = "No autenticado"),
            @ApiResponse(responseCode = "403", description = "Sin permisos o cambio de contraseña pendiente")
    })
    public ResponseEntity<ResumenMonitoreoResponse> resumen() {
        return ResponseEntity.ok(monitoreoService.resumen());
    }

    @GetMapping("/historico")
    @Operation(summary = "Serie histórica de una métrica (InfluxDB)",
            description = "Devuelve series temporales por sensor para TEMPERATURA, HUMEDAD o LUZ "
                    + "en el rango indicado (máximo 7 días). Filtro opcional por código de sensor.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Serie histórica"),
            @ApiResponse(responseCode = "400", description = "Parámetros inválidos o InfluxDB no configurado"),
            @ApiResponse(responseCode = "401", description = "No autenticado"),
            @ApiResponse(responseCode = "403", description = "Sin permisos o cambio de contraseña pendiente")
    })
    public ResponseEntity<HistoricoResponse> historico(
            @RequestParam("metrica") String metrica,
            @RequestParam("desde") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime desde,
            @RequestParam("hasta") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime hasta,
            @RequestParam(name = "sensor", required = false) String sensor) {
        return ResponseEntity.ok(monitoreoService.historico(metrica, desde, hasta, sensor));
    }

    @GetMapping("/salud-outbox")
    @Operation(summary = "Estado del outbox de lecturas hacia InfluxDB",
            description = "Contadores reales por estado (PENDIENTE/ENVIANDO/ENVIADO/ERROR) y agregados "
                    + "de reintentos/errores. Solo lectura; no incluye errores ni credenciales.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Estado del outbox"),
            @ApiResponse(responseCode = "401", description = "No autenticado"),
            @ApiResponse(responseCode = "403", description = "Sin permisos o cambio de contraseña pendiente")
    })
    public ResponseEntity<SaludOutboxResponse> saludOutbox() {
        return ResponseEntity.ok(monitoreoService.saludOutbox());
    }
}
