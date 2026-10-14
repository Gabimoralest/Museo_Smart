package com.museosmart.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Búfer persistente (outbox) de mediciones hacia InfluxDB.
 *
 * <p>Se escribe en la fase de ingestion MQTT y se drena en la fase de InfluxDB
 * (aun no implementada). No se elimina ni se reemplaza en esta fase.</p>
 */
@Entity
@Table(name = "medicion_pendiente")
public class MedicionPendiente {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "mensaje_iot_id", nullable = false)
    private MensajeIot mensajeIot;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sensor_id")
    private Sensor sensor;

    @Column(name = "metrica", nullable = false, length = 40)
    private String metrica;

    @Column(name = "valor", nullable = false, precision = 12, scale = 2)
    private BigDecimal valor;

    @Column(name = "unidad", length = 20)
    private String unidad;

    @Column(name = "medido_en", nullable = false)
    private OffsetDateTime medidoEn;

    @Column(name = "estado", nullable = false, length = 20)
    private String estado = "PENDIENTE";

    @Column(name = "intentos", nullable = false)
    private int intentos = 0;

    @Column(name = "proximo_intento_en")
    private OffsetDateTime proximoIntentoEn;

    @Column(name = "ultimo_error", columnDefinition = "text")
    private String ultimoError;

    @Column(name = "enviado_en")
    private OffsetDateTime enviadoEn;

    @Column(name = "creado_en", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime creadoEn;

    @Column(name = "actualizado_en", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime actualizadoEn;

    public Long getId() {
        return id;
    }

    public MensajeIot getMensajeIot() {
        return mensajeIot;
    }

    public void setMensajeIot(MensajeIot mensajeIot) {
        this.mensajeIot = mensajeIot;
    }

    public Sensor getSensor() {
        return sensor;
    }

    public void setSensor(Sensor sensor) {
        this.sensor = sensor;
    }

    public String getMetrica() {
        return metrica;
    }

    public void setMetrica(String metrica) {
        this.metrica = metrica;
    }

    public BigDecimal getValor() {
        return valor;
    }

    public void setValor(BigDecimal valor) {
        this.valor = valor;
    }

    public String getUnidad() {
        return unidad;
    }

    public void setUnidad(String unidad) {
        this.unidad = unidad;
    }

    public OffsetDateTime getMedidoEn() {
        return medidoEn;
    }

    public void setMedidoEn(OffsetDateTime medidoEn) {
        this.medidoEn = medidoEn;
    }

    public String getEstado() {
        return estado;
    }

    public void setEstado(String estado) {
        this.estado = estado;
    }

    public int getIntentos() {
        return intentos;
    }

    public void setIntentos(int intentos) {
        this.intentos = intentos;
    }

    public OffsetDateTime getProximoIntentoEn() {
        return proximoIntentoEn;
    }

    public void setProximoIntentoEn(OffsetDateTime proximoIntentoEn) {
        this.proximoIntentoEn = proximoIntentoEn;
    }

    public String getUltimoError() {
        return ultimoError;
    }

    public void setUltimoError(String ultimoError) {
        this.ultimoError = ultimoError;
    }

    public OffsetDateTime getEnviadoEn() {
        return enviadoEn;
    }

    public void setEnviadoEn(OffsetDateTime enviadoEn) {
        this.enviadoEn = enviadoEn;
    }

    public OffsetDateTime getCreadoEn() {
        return creadoEn;
    }

    public OffsetDateTime getActualizadoEn() {
        return actualizadoEn;
    }
}
