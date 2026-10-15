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
import java.util.UUID;

/**
 * Interaccion de un visitante anonimo con una exhibicion (tabla {@code visita},
 * creada en V3). Se reutiliza el esquema existente; no se redefine la tabla.
 *
 * <p>Reglas del esquema que esta entidad respeta:</p>
 * <ul>
 *   <li>{@code ocurrido_en} y {@code ventana_inicio} los fija la base de datos
 *       (default {@code now()} y trigger {@code trg_visita_ventana}); por eso la
 *       entidad no los inserta.</li>
 *   <li>{@code ventana_inicio} es el bucket de 1 minuto usado por el indice
 *       unico {@code uq_visita_dedup} para deduplicar.</li>
 *   <li>{@code valida} la decide el backend (nunca el frontend). Solo las
 *       visitas con {@code valida = true} cuentan en el ranking.</li>
 * </ul>
 *
 * <p>El alta de visitas se realiza mediante el repositorio con
 * {@code ON CONFLICT DO NOTHING} para aprovechar la deduplicacion de PostgreSQL
 * sin provocar errores por duplicados.</p>
 */
@Entity
@Table(name = "visita")
public class Visita {

    /** Valor permitido por ck_visita_fuente: interaccion originada por el cursor/navegacion. */
    public static final String FUENTE_CURSOR = "CURSOR";
    /** Valor permitido por ck_visita_fuente: interaccion originada por el simulador. */
    public static final String FUENTE_SIMULADOR = "SIMULADOR";
    /** Valor permitido por ck_visita_fuente: interaccion originada por un sensor. */
    public static final String FUENTE_SENSOR = "SENSOR";
    /** Valor permitido por ck_visita_fuente: interaccion originada por un codigo QR. */
    public static final String FUENTE_QR = "QR";
    /** Valor permitido por ck_visita_fuente: cualquier otra fuente no clasificada. */
    public static final String FUENTE_OTRO = "OTRO";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exhibicion_id", nullable = false)
    private Exhibicion exhibicion;

    @Column(name = "sesion_anonima_id", nullable = false)
    private UUID sesionAnonimaId;

    @Column(name = "fuente", nullable = false, length = 20)
    private String fuente;

    @Column(name = "ocurrido_en", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime ocurridoEn;

    @Column(name = "ventana_inicio", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime ventanaInicio;

    @Column(name = "valida", nullable = false)
    private boolean valida;

    @Column(name = "motivo_invalida", length = 120)
    private String motivoInvalida;

    @Column(name = "validada_en")
    private OffsetDateTime validadaEn;

    @Column(name = "registrado_en", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime registradoEn;

    public Long getId() {
        return id;
    }

    public Exhibicion getExhibicion() {
        return exhibicion;
    }

    public void setExhibicion(Exhibicion exhibicion) {
        this.exhibicion = exhibicion;
    }

    public UUID getSesionAnonimaId() {
        return sesionAnonimaId;
    }

    public void setSesionAnonimaId(UUID sesionAnonimaId) {
        this.sesionAnonimaId = sesionAnonimaId;
    }

    public String getFuente() {
        return fuente;
    }

    public void setFuente(String fuente) {
        this.fuente = fuente;
    }

    public OffsetDateTime getOcurridoEn() {
        return ocurridoEn;
    }

    public OffsetDateTime getVentanaInicio() {
        return ventanaInicio;
    }

    public boolean isValida() {
        return valida;
    }

    public void setValida(boolean valida) {
        this.valida = valida;
    }

    public String getMotivoInvalida() {
        return motivoInvalida;
    }

    public void setMotivoInvalida(String motivoInvalida) {
        this.motivoInvalida = motivoInvalida;
    }

    public OffsetDateTime getValidadaEn() {
        return validadaEn;
    }

    public void setValidadaEn(OffsetDateTime validadaEn) {
        this.validadaEn = validadaEn;
    }

    public OffsetDateTime getRegistradoEn() {
        return registradoEn;
    }
}
