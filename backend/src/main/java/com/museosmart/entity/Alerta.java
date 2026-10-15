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

import java.time.OffsetDateTime;

/**
 * Alerta del sistema. Deduplicada por (sensor_id, condicion_clave) mientras
 * permanece ABIERTA o RECONOCIDA (indice unico parcial uq_alerta_condicion_activa).
 */
@Entity
@Table(name = "alerta")
public class Alerta {

    public static final String ESTADO_ABIERTA = "ABIERTA";
    public static final String ESTADO_RECONOCIDA = "RECONOCIDA";
    public static final String ESTADO_RESUELTA = "RESUELTA";
    public static final String ESTADO_CERRADA = "CERRADA";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sensor_id")
    private Sensor sensor;

    @Column(name = "tipo", nullable = false, length = 20)
    private String tipo;

    @Column(name = "severidad", nullable = false, length = 20)
    private String severidad;

    @Column(name = "estado", nullable = false, length = 20)
    private String estado = ESTADO_ABIERTA;

    @Column(name = "descripcion", nullable = false, columnDefinition = "text")
    private String descripcion;

    @Column(name = "condicion_clave", nullable = false, length = 160)
    private String condicionClave;

    @Column(name = "iniciada_en", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime iniciadaEn;

    @Column(name = "resuelta_en")
    private OffsetDateTime resueltaEn;

    @Column(name = "creado_en", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime creadoEn;

    @Column(name = "actualizado_en", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime actualizadoEn;

    public Long getId() {
        return id;
    }

    public Sensor getSensor() {
        return sensor;
    }

    public void setSensor(Sensor sensor) {
        this.sensor = sensor;
    }

    public String getTipo() {
        return tipo;
    }

    public void setTipo(String tipo) {
        this.tipo = tipo;
    }

    public String getSeveridad() {
        return severidad;
    }

    public void setSeveridad(String severidad) {
        this.severidad = severidad;
    }

    public String getEstado() {
        return estado;
    }

    public void setEstado(String estado) {
        this.estado = estado;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public void setDescripcion(String descripcion) {
        this.descripcion = descripcion;
    }

    public String getCondicionClave() {
        return condicionClave;
    }

    public void setCondicionClave(String condicionClave) {
        this.condicionClave = condicionClave;
    }

    public OffsetDateTime getIniciadaEn() {
        return iniciadaEn;
    }

    public OffsetDateTime getResueltaEn() {
        return resueltaEn;
    }

    public void setResueltaEn(OffsetDateTime resueltaEn) {
        this.resueltaEn = resueltaEn;
    }

    public OffsetDateTime getCreadoEn() {
        return creadoEn;
    }

    public OffsetDateTime getActualizadoEn() {
        return actualizadoEn;
    }
}
