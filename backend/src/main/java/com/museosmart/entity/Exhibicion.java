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

@Entity
@Table(name = "exhibicion")
public class Exhibicion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sala_id", nullable = false)
    private Sala sala;

    @Column(name = "codigo", nullable = false, length = 30)
    private String codigo;

    @Column(name = "titulo", nullable = false, length = 200)
    private String titulo;

    @Column(name = "descripcion", columnDefinition = "text")
    private String descripcion;

    @Column(name = "contexto_historico", columnDefinition = "text")
    private String contextoHistorico;

    @Column(name = "autor_cultura", length = 200)
    private String autorCultura;

    @Column(name = "periodo", length = 150)
    private String periodo;

    @Column(name = "material", length = 200)
    private String material;

    @Column(name = "fecha_creacion_aprox", columnDefinition = "text")
    private String fechaCreacionAprox;

    @Column(name = "temp_min_c", precision = 5, scale = 2)
    private BigDecimal tempMinC;

    @Column(name = "temp_max_c", precision = 5, scale = 2)
    private BigDecimal tempMaxC;

    @Column(name = "humedad_min_pct", precision = 5, scale = 2)
    private BigDecimal humedadMinPct;

    @Column(name = "humedad_max_pct", precision = 5, scale = 2)
    private BigDecimal humedadMaxPct;

    @Column(name = "luz_max_lux", precision = 7, scale = 2)
    private BigDecimal luzMaxLux;

    @Column(name = "activa", nullable = false)
    private boolean activa = true;

    @Column(name = "creado_en", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime creadoEn;

    @Column(name = "actualizado_en", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime actualizadoEn;

    public Long getId() {
        return id;
    }

    public Sala getSala() {
        return sala;
    }

    public void setSala(Sala sala) {
        this.sala = sala;
    }

    public String getCodigo() {
        return codigo;
    }

    public void setCodigo(String codigo) {
        this.codigo = codigo;
    }

    public String getTitulo() {
        return titulo;
    }

    public void setTitulo(String titulo) {
        this.titulo = titulo;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public void setDescripcion(String descripcion) {
        this.descripcion = descripcion;
    }

    public String getContextoHistorico() {
        return contextoHistorico;
    }

    public void setContextoHistorico(String contextoHistorico) {
        this.contextoHistorico = contextoHistorico;
    }

    public String getAutorCultura() {
        return autorCultura;
    }

    public void setAutorCultura(String autorCultura) {
        this.autorCultura = autorCultura;
    }

    public String getPeriodo() {
        return periodo;
    }

    public void setPeriodo(String periodo) {
        this.periodo = periodo;
    }

    public String getMaterial() {
        return material;
    }

    public void setMaterial(String material) {
        this.material = material;
    }

    public String getFechaCreacionAprox() {
        return fechaCreacionAprox;
    }

    public void setFechaCreacionAprox(String fechaCreacionAprox) {
        this.fechaCreacionAprox = fechaCreacionAprox;
    }

    public BigDecimal getTempMinC() {
        return tempMinC;
    }

    public void setTempMinC(BigDecimal tempMinC) {
        this.tempMinC = tempMinC;
    }

    public BigDecimal getTempMaxC() {
        return tempMaxC;
    }

    public void setTempMaxC(BigDecimal tempMaxC) {
        this.tempMaxC = tempMaxC;
    }

    public BigDecimal getHumedadMinPct() {
        return humedadMinPct;
    }

    public void setHumedadMinPct(BigDecimal humedadMinPct) {
        this.humedadMinPct = humedadMinPct;
    }

    public BigDecimal getHumedadMaxPct() {
        return humedadMaxPct;
    }

    public void setHumedadMaxPct(BigDecimal humedadMaxPct) {
        this.humedadMaxPct = humedadMaxPct;
    }

    public BigDecimal getLuzMaxLux() {
        return luzMaxLux;
    }

    public void setLuzMaxLux(BigDecimal luzMaxLux) {
        this.luzMaxLux = luzMaxLux;
    }

    public boolean isActiva() {
        return activa;
    }

    public void setActiva(boolean activa) {
        this.activa = activa;
    }

    public OffsetDateTime getCreadoEn() {
        return creadoEn;
    }

    public OffsetDateTime getActualizadoEn() {
        return actualizadoEn;
    }
}
