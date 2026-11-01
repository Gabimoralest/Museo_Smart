package com.museosmart.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

@Entity
@Table(name = "sala")
public class Sala {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

    @Column(name = "nombre", nullable = false, length = 100)
    private String nombre;

    @Column(name = "descripcion", columnDefinition = "text")
    private String descripcion;

    @Column(name = "estado", nullable = false, length = 20)
    private String estado = "activa";

    @Column(name = "orden", nullable = false)
    private Short orden;

    /**
     * Codigo estable de la sala en el modelo 3D (Blender): {@code SALA_1..SALA_6}.
     * Se expone en la API publica para que el visor pueda cruzar el modelo con
     * los datos sin depender de nombres de nodo ni de ids numericos.
     */
    @Column(name = "codigo_3d", nullable = false, length = 20)
    private String codigo3d;

    @Column(name = "creado_en", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime creadoEn;

    @Column(name = "actualizado_en", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime actualizadoEn;

    public Long getId() {
        return id;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public void setDescripcion(String descripcion) {
        this.descripcion = descripcion;
    }

    public String getEstado() {
        return estado;
    }

    public void setEstado(String estado) {
        this.estado = estado;
    }

    public Short getOrden() {
        return orden;
    }

    public void setOrden(Short orden) {
        this.orden = orden;
    }

    public String getCodigo3d() {
        return codigo3d;
    }

    public void setCodigo3d(String codigo3d) {
        this.codigo3d = codigo3d;
    }

    public OffsetDateTime getCreadoEn() {
        return creadoEn;
    }

    public OffsetDateTime getActualizadoEn() {
        return actualizadoEn;
    }
}
