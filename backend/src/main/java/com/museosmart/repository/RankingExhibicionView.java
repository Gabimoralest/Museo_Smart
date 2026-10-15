package com.museosmart.repository;

/**
 * Proyeccion de una fila de la vista {@code v_ranking_exhibicion} (creada en V3).
 * No es una entidad: la vista se consulta en modo lectura.
 *
 * <p>El orden y la resolucion de empates (por popularidad descendente y, en
 * caso de empate, alfabeticamente por titulo) los aplica la consulta del
 * repositorio, no la vista.</p>
 */
public interface RankingExhibicionView {

    Long getExhibicionId();

    String getCodigo();

    String getTitulo();

    Long getSalaId();

    String getSalaNombre();

    Long getTotalVisitasValidas();
}
