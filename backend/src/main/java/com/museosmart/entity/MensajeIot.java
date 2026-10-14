package com.museosmart.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Mensaje IoT crudo recibido por MQTT.
 *
 * <p>La columna {@code mensaje_id} es unica (clave de idempotencia): un mismo
 * UUID no puede registrarse dos veces. El payload original se conserva como
 * {@code jsonb} para trazabilidad y reprocesamiento.</p>
 */
@Entity
@Table(name = "mensaje_iot")
public class MensajeIot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

    @Column(name = "mensaje_id", nullable = false, updatable = false)
    private UUID mensajeId;

    @Column(name = "topico", nullable = false, length = 255)
    private String topico;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload", nullable = false, columnDefinition = "jsonb")
    private String payload;

    @Column(name = "sensor_codigo", length = 80)
    private String sensorCodigo;

    @Column(name = "estado_procesamiento", nullable = false, length = 20)
    private String estadoProcesamiento = "RECIBIDO";

    @Column(name = "error", columnDefinition = "text")
    private String error;

    @Column(name = "recibido_en", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime recibidoEn;

    @Column(name = "procesado_en")
    private OffsetDateTime procesadoEn;

    public Long getId() {
        return id;
    }

    public UUID getMensajeId() {
        return mensajeId;
    }

    public void setMensajeId(UUID mensajeId) {
        this.mensajeId = mensajeId;
    }

    public String getTopico() {
        return topico;
    }

    public void setTopico(String topico) {
        this.topico = topico;
    }

    public String getPayload() {
        return payload;
    }

    public void setPayload(String payload) {
        this.payload = payload;
    }

    public String getSensorCodigo() {
        return sensorCodigo;
    }

    public void setSensorCodigo(String sensorCodigo) {
        this.sensorCodigo = sensorCodigo;
    }

    public String getEstadoProcesamiento() {
        return estadoProcesamiento;
    }

    public void setEstadoProcesamiento(String estadoProcesamiento) {
        this.estadoProcesamiento = estadoProcesamiento;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }

    public OffsetDateTime getRecibidoEn() {
        return recibidoEn;
    }

    public OffsetDateTime getProcesadoEn() {
        return procesadoEn;
    }

    public void setProcesadoEn(OffsetDateTime procesadoEn) {
        this.procesadoEn = procesadoEn;
    }
}
