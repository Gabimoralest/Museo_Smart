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
 * Sensor fisico o simulado.
 *
 * <p>Un sensor de categoria {@code AMBIENTAL} (tipo {@code MULTI}) pertenece a
 * una {@link Sala} y reporta varias metricas (temperatura, humedad y
 * luminosidad) como un unico dispositivo. Un sensor de categoria
 * {@code PRESENCIA} pertenece a una {@link Exhibicion}.</p>
 *
 * <p>La coherencia categoria/ubicacion/tipo la garantiza la base de datos
 * mediante las restricciones CHECK definidas en V7.</p>
 */
@Entity
@Table(name = "sensor")
public class Sensor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

    @Column(name = "codigo", nullable = false, length = 80)
    private String codigo;

    @Column(name = "tipo", nullable = false, length = 30)
    private String tipo;

    @Column(name = "categoria", nullable = false, length = 20)
    private String categoria;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sala_id")
    private Sala sala;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exhibicion_id")
    private Exhibicion exhibicion;

    @Column(name = "estado", nullable = false, length = 20)
    private String estado = "ACTIVO";

    @Column(name = "unidad", length = 20)
    private String unidad;

    @Column(name = "descripcion", columnDefinition = "text")
    private String descripcion;

    /**
     * Ultimo estado de presencia observado por un sensor de categoria
     * PRESENCIA. {@code null} = sin lectura todavia. Solo lo gestiona la
     * ingestion MQTT; permite detectar el flanco de subida para contabilizar
     * una visita por episodio de presencia.
     */
    @Column(name = "presencia_actual")
    private Boolean presenciaActual;

    @Column(name = "instalado_en")
    private OffsetDateTime instaladoEn;

    @Column(name = "creado_en", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime creadoEn;

    @Column(name = "actualizado_en", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime actualizadoEn;

    public Long getId() {
        return id;
    }

    public String getCodigo() {
        return codigo;
    }

    public void setCodigo(String codigo) {
        this.codigo = codigo;
    }

    public String getTipo() {
        return tipo;
    }

    public void setTipo(String tipo) {
        this.tipo = tipo;
    }

    public String getCategoria() {
        return categoria;
    }

    public void setCategoria(String categoria) {
        this.categoria = categoria;
    }

    public Sala getSala() {
        return sala;
    }

    public void setSala(Sala sala) {
        this.sala = sala;
    }

    public Exhibicion getExhibicion() {
        return exhibicion;
    }

    public void setExhibicion(Exhibicion exhibicion) {
        this.exhibicion = exhibicion;
    }

    public String getEstado() {
        return estado;
    }

    public void setEstado(String estado) {
        this.estado = estado;
    }

    public String getUnidad() {
        return unidad;
    }

    public void setUnidad(String unidad) {
        this.unidad = unidad;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public void setDescripcion(String descripcion) {
        this.descripcion = descripcion;
    }

    public Boolean getPresenciaActual() {
        return presenciaActual;
    }

    public void setPresenciaActual(Boolean presenciaActual) {
        this.presenciaActual = presenciaActual;
    }

    public OffsetDateTime getInstaladoEn() {
        return instaladoEn;
    }

    public void setInstaladoEn(OffsetDateTime instaladoEn) {
        this.instaladoEn = instaladoEn;
    }

    public OffsetDateTime getCreadoEn() {
        return creadoEn;
    }

    public OffsetDateTime getActualizadoEn() {
        return actualizadoEn;
    }
}
