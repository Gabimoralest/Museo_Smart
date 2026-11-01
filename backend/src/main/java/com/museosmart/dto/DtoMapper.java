package com.museosmart.dto;

import com.museosmart.entity.ContenidoMultimedia;
import com.museosmart.entity.Exhibicion;
import com.museosmart.entity.Sala;
import com.museosmart.entity.UsuarioAdmin;

import java.util.Map;

public final class DtoMapper {

    /** Categoria de la exhibicion especial (sin sala). */
    public static final String CATEGORIA_ESPECIAL = "Exhibición especial";

    /** Nombre de sala mostrado para la exhibicion especial. */
    public static final String SALA_ESPECIAL = "Plaza central";

    private DtoMapper() {
    }

    public static SalaResponse toSalaResponse(Sala sala) {
        return new SalaResponse(
                sala.getId(),
                sala.getNombre(),
                sala.getDescripcion(),
                sala.getEstado(),
                sala.getOrden(),
                sala.getCodigo3d()
        );
    }

    /** La categoria se deriva del nombre de la sala; la especial tiene la suya. */
    public static String categoria(Exhibicion exhibicion) {
        Sala sala = exhibicion.getSala();
        return sala != null ? sala.getNombre() : CATEGORIA_ESPECIAL;
    }

    public static String salaNombre(Exhibicion exhibicion) {
        Sala sala = exhibicion.getSala();
        return sala != null ? sala.getNombre() : SALA_ESPECIAL;
    }

    public static ExhibicionAdminResponse toExhibicionAdminResponse(Exhibicion exhibicion, String nombreEditor,
                                                                    ContenidoMultimedia imagen,
                                                                    ContenidoMultimedia video) {
        Sala sala = exhibicion.getSala();
        return new ExhibicionAdminResponse(
                exhibicion.getId(),
                sala != null ? sala.getId() : null,
                salaNombre(exhibicion),
                exhibicion.getCodigo(),
                exhibicion.getUbicacion3d() != null ? exhibicion.getUbicacion3d().getCodigo() : null,
                exhibicion.getTitulo(),
                exhibicion.getDescripcionCorta(),
                exhibicion.getDescripcion(),
                exhibicion.getAutorCultura(),
                exhibicion.getPeriodo(),
                exhibicion.getMaterial(),
                exhibicion.getDatoCurioso(),
                categoria(exhibicion),
                sala == null,
                exhibicion.getTempMinC(),
                exhibicion.getTempMaxC(),
                exhibicion.getHumedadMinPct(),
                exhibicion.getHumedadMaxPct(),
                exhibicion.getLuzMaxLux(),
                exhibicion.isActiva(),
                imagen != null,
                urlDe(imagen),
                urlDe(video),
                exhibicion.getVersion(),
                exhibicion.getActualizadoEn(),
                nombreEditor
        );
    }

    public static ExhibicionResponse toExhibicionResponse(Exhibicion exhibicion,
                                                          ContenidoMultimedia imagen,
                                                          ContenidoMultimedia video) {
        Sala sala = exhibicion.getSala();
        return new ExhibicionResponse(
                exhibicion.getId(),
                sala != null ? sala.getId() : null,
                salaNombre(exhibicion),
                exhibicion.getCodigo(),
                exhibicion.getUbicacion3d() != null ? exhibicion.getUbicacion3d().getCodigo() : null,
                exhibicion.getTitulo(),
                exhibicion.getDescripcionCorta(),
                exhibicion.getDescripcion(),
                exhibicion.getAutorCultura(),
                exhibicion.getPeriodo(),
                exhibicion.getMaterial(),
                exhibicion.getDatoCurioso(),
                categoria(exhibicion),
                sala == null,
                exhibicion.getTempMinC(),
                exhibicion.getTempMaxC(),
                exhibicion.getHumedadMinPct(),
                exhibicion.getHumedadMaxPct(),
                exhibicion.getLuzMaxLux(),
                exhibicion.isActiva(),
                urlDe(imagen),
                urlDe(video)
        );
    }

    /** URL publica de un multimedia, o null si no existe la fila o la clave. */
    public static String urlDe(ContenidoMultimedia multimedia) {
        if (multimedia == null || multimedia.getArchivoClave() == null) {
            return null;
        }
        return "/media/" + multimedia.getArchivoClave();
    }

    public static UsuarioAdminResponse toUsuarioAdminResponse(UsuarioAdmin usuario) {
        return new UsuarioAdminResponse(
                usuario.getId(),
                usuario.getNombre(),
                usuario.getCorreo(),
                usuario.getRol(),
                usuario.getEstado(),
                usuario.isPrimerInicioSesion(),
                usuario.getUltimoAccesoEn(),
                usuario.getCreadoEn(),
                usuario.getActualizadoEn()
        );
    }
}
