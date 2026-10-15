package com.museosmart.dto;

import com.museosmart.repository.RankingExhibicionView;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.ArrayList;
import java.util.List;

/**
 * Fila del ranking de popularidad de exhibiciones.
 *
 * @param posicion             posición en el ranking (1 = más popular). Las
 *                             exhibiciones con el mismo número de visitas
 *                             válidas comparten la misma posición.
 * @param exhibicionId         identificador de la exhibición.
 * @param codigo               código estable de la exhibición.
 * @param titulo               título de la exhibición.
 * @param salaId               identificador de la sala.
 * @param salaNombre           nombre de la sala.
 * @param totalVisitasValidas  número de interacciones válidas contabilizadas.
 */
@Schema(description = "Fila del ranking de popularidad de exhibiciones")
public record RankingExhibicionResponse(

        @Schema(description = "Posición en el ranking (1 = más popular; empates comparten posición)",
                example = "1")
        int posicion,

        @Schema(description = "Identificador de la exhibición", example = "1")
        Long exhibicionId,

        @Schema(description = "Código estable de la exhibición", example = "pintura-historica-01")
        String codigo,

        @Schema(description = "Título de la exhibición")
        String titulo,

        @Schema(description = "Identificador de la sala", example = "1")
        Long salaId,

        @Schema(description = "Nombre de la sala", example = "Pintura histórica")
        String salaNombre,

        @Schema(description = "Total de interacciones válidas", example = "42")
        long totalVisitasValidas
) {
    public static RankingExhibicionResponse from(RankingExhibicionView vista, int posicion) {
        return new RankingExhibicionResponse(
                posicion,
                vista.getExhibicionId(),
                vista.getCodigo(),
                vista.getTitulo(),
                vista.getSalaId(),
                vista.getSalaNombre(),
                vista.getTotalVisitasValidas());
    }

    /**
     * Convierte una lista de filas (ya ordenadas por popularidad descendente y
     * título ascendente) en respuestas con su posición. Las filas con el mismo
     * total comparten posición: la siguiente posición salta tantos puestos como
     * empates haya (1, 1, 3...). Refleja fielmente que los empates comparten
     * puesto sin reordenar.
     */
    public static List<RankingExhibicionResponse> desdeRanking(List<RankingExhibicionView> filas) {
        List<RankingExhibicionResponse> respuesta = new ArrayList<>(filas.size());
        long totalAnterior = Long.MIN_VALUE;
        int posicion = 0;
        for (int i = 0; i < filas.size(); i++) {
            RankingExhibicionView fila = filas.get(i);
            if (fila.getTotalVisitasValidas() != totalAnterior) {
                posicion = i + 1;
                totalAnterior = fila.getTotalVisitasValidas();
            }
            respuesta.add(from(fila, posicion));
        }
        return respuesta;
    }
}
