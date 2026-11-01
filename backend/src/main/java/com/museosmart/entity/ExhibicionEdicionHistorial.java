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
 * Historial campo a campo de las ediciones de una exhibicion (V14).
 *
 * <p>Una fila por cada campo que realmente cambio en un PUT. Lo llena el
 * backend; la tabla solo almacena, no genera eventos por trigger.</p>
 */
@Entity
@Table(name = "exhibicion_edicion_historial")
public class ExhibicionEdicionHistorial {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exhibicion_id", nullable = false)
    private Exhibicion exhibicion;

    @Column(name = "campo", nullable = false, length = 80)
    private String campo;

    @Column(name = "valor_anterior", columnDefinition = "text")
    private String valorAnterior;

    @Column(name = "valor_nuevo", columnDefinition = "text")
    private String valorNuevo;

    @Column(name = "editado_por")
    private Long editadoPor;

    @Column(name = "editado_en", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime editadoEn;

    public Long getId() {
        return id;
    }

    public Exhibicion getExhibicion() {
        return exhibicion;
    }

    public void setExhibicion(Exhibicion exhibicion) {
        this.exhibicion = exhibicion;
    }

    public String getCampo() {
        return campo;
    }

    public void setCampo(String campo) {
        this.campo = campo;
    }

    public String getValorAnterior() {
        return valorAnterior;
    }

    public void setValorAnterior(String valorAnterior) {
        this.valorAnterior = valorAnterior;
    }

    public String getValorNuevo() {
        return valorNuevo;
    }

    public void setValorNuevo(String valorNuevo) {
        this.valorNuevo = valorNuevo;
    }

    public Long getEditadoPor() {
        return editadoPor;
    }

    public void setEditadoPor(Long editadoPor) {
        this.editadoPor = editadoPor;
    }

    public OffsetDateTime getEditadoEn() {
        return editadoEn;
    }
}
