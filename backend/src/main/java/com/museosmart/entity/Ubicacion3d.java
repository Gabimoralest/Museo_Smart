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
 * Ubicacion fisica de una exhibicion en el modelo 3D de Blender.
 *
 * <p>El {@code codigo} coincide con el nombre del nodo vacio del GLB
 * (p. ej. {@code EXH_S1_01}). El visor 3D cruza ese valor con el
 * {@code userData.exhibicion_id} que Blender incrusta en cada nodo, de modo
 * que reemplazar el GLB no exige cambios de codigo.</p>
 *
 * <p>En esta fase la entidad es de SOLO LECTURA: no se expone a traves de la
 * API ni se modifica desde el backend. Las coordenadas y demas datos internos
 * del modelo no forman parte del contrato publico.</p>
 */
@Entity
@Table(name = "ubicacion_3d")
public class Ubicacion3d {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

    @Column(name = "codigo", nullable = false, length = 30)
    private String codigo;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sala_id", nullable = false)
    private Sala sala;

    @Column(name = "nombre_blender", length = 120)
    private String nombreBlender;

    @Column(name = "tipo", length = 20)
    private String tipo;

    @Column(name = "estado", nullable = false, length = 20)
    private String estado;

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

    public Sala getSala() {
        return sala;
    }

    public String getNombreBlender() {
        return nombreBlender;
    }

    public String getTipo() {
        return tipo;
    }

    public String getEstado() {
        return estado;
    }

    public OffsetDateTime getCreadoEn() {
        return creadoEn;
    }

    public OffsetDateTime getActualizadoEn() {
        return actualizadoEn;
    }
}
