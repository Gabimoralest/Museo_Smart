package com.museosmart.dto;

import com.museosmart.entity.Exhibicion;
import com.museosmart.entity.Sala;
import com.museosmart.entity.UsuarioAdmin;

public final class DtoMapper {

    private DtoMapper() {
    }

    public static SalaResponse toSalaResponse(Sala sala) {
        return new SalaResponse(
                sala.getId(),
                sala.getNombre(),
                sala.getDescripcion(),
                sala.getEstado(),
                sala.getOrden()
        );
    }

    public static ExhibicionResponse toExhibicionResponse(Exhibicion exhibicion) {
        Sala sala = exhibicion.getSala();
        return new ExhibicionResponse(
                exhibicion.getId(),
                sala != null ? sala.getId() : null,
                sala != null ? sala.getNombre() : null,
                exhibicion.getCodigo(),
                exhibicion.getTitulo(),
                exhibicion.getDescripcion(),
                exhibicion.getContextoHistorico(),
                exhibicion.getAutorCultura(),
                exhibicion.getPeriodo(),
                exhibicion.getMaterial(),
                exhibicion.getFechaCreacionAprox(),
                exhibicion.getTempMinC(),
                exhibicion.getTempMaxC(),
                exhibicion.getHumedadMinPct(),
                exhibicion.getHumedadMaxPct(),
                exhibicion.getLuzMaxLux(),
                exhibicion.isActiva()
        );
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
