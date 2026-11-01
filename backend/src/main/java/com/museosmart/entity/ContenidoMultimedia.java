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
 * Contenido multimedia de una exhibicion almacenado en el servidor local (V15).
 *
 * <p>Se guarda un maximo de una IMAGEN y un VIDEO por exhibicion (indice unico
 * {@code (exhibicion_id, tipo)}). El binario vive en {@code APP_MEDIA_DIR}; la
 * fila solo contiene metadatos y la clave relativa del archivo.</p>
 */
@Entity
@Table(name = "contenido_multimedia")
public class ContenidoMultimedia {

    public static final String TIPO_IMAGEN = "IMAGEN";
    public static final String TIPO_VIDEO = "VIDEO";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exhibicion_id", nullable = false)
    private Exhibicion exhibicion;

    @Column(name = "tipo", nullable = false, length = 20)
    private String tipo;

    /** Clave relativa del archivo dentro de APP_MEDIA_DIR (p. ej. 12/uuid.jpg). */
    @Column(name = "archivo_clave", length = 400)
    private String archivoClave;

    @Column(name = "nombre_original", length = 400)
    private String nombreOriginal;

    @Column(name = "mime_type", length = 120)
    private String mimeType;

    @Column(name = "tamano_bytes")
    private Long tamanoBytes;

    @Column(name = "subido_por")
    private Long subidoPor;

    @Column(name = "url", length = 1024)
    private String url;

    @Column(name = "creado_en", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime creadoEn;

    public Long getId() {
        return id;
    }

    public Exhibicion getExhibicion() {
        return exhibicion;
    }

    public void setExhibicion(Exhibicion exhibicion) {
        this.exhibicion = exhibicion;
    }

    public String getTipo() {
        return tipo;
    }

    public void setTipo(String tipo) {
        this.tipo = tipo;
    }

    public String getArchivoClave() {
        return archivoClave;
    }

    public void setArchivoClave(String archivoClave) {
        this.archivoClave = archivoClave;
    }

    public String getNombreOriginal() {
        return nombreOriginal;
    }

    public void setNombreOriginal(String nombreOriginal) {
        this.nombreOriginal = nombreOriginal;
    }

    public String getMimeType() {
        return mimeType;
    }

    public void setMimeType(String mimeType) {
        this.mimeType = mimeType;
    }

    public Long getTamanoBytes() {
        return tamanoBytes;
    }

    public void setTamanoBytes(Long tamanoBytes) {
        this.tamanoBytes = tamanoBytes;
    }

    public Long getSubidoPor() {
        return subidoPor;
    }

    public void setSubidoPor(Long subidoPor) {
        this.subidoPor = subidoPor;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public OffsetDateTime getCreadoEn() {
        return creadoEn;
    }
}
