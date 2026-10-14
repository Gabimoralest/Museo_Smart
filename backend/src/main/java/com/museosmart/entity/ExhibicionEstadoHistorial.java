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

@Entity
@Table(name = "exhibicion_estado_historial")
public class ExhibicionEstadoHistorial {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exhibicion_id", nullable = false)
    private Exhibicion exhibicion;

    @Column(name = "estado_anterior", nullable = false)
    private boolean estadoAnterior;

    @Column(name = "estado_nuevo", nullable = false)
    private boolean estadoNuevo;

    @Column(name = "motivo", columnDefinition = "text")
    private String motivo;

    @Column(name = "cambiado_por")
    private Long cambiadoPor;

    @Column(name = "cambiado_en", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime cambiadoEn;

    public Long getId() {
        return id;
    }

    public Exhibicion getExhibicion() {
        return exhibicion;
    }

    public void setExhibicion(Exhibicion exhibicion) {
        this.exhibicion = exhibicion;
    }

    public boolean isEstadoAnterior() {
        return estadoAnterior;
    }

    public void setEstadoAnterior(boolean estadoAnterior) {
        this.estadoAnterior = estadoAnterior;
    }

    public boolean isEstadoNuevo() {
        return estadoNuevo;
    }

    public void setEstadoNuevo(boolean estadoNuevo) {
        this.estadoNuevo = estadoNuevo;
    }

    public String getMotivo() {
        return motivo;
    }

    public void setMotivo(String motivo) {
        this.motivo = motivo;
    }

    public Long getCambiadoPor() {
        return cambiadoPor;
    }

    public void setCambiadoPor(Long cambiadoPor) {
        this.cambiadoPor = cambiadoPor;
    }

    public OffsetDateTime getCambiadoEn() {
        return cambiadoEn;
    }
}
