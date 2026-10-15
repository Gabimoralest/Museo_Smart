package com.museosmart.repository;

import com.museosmart.entity.Visita;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Acceso a la tabla {@code visita} y a la vista {@code v_ranking_exhibicion}
 * creadas en V3.
 *
 * <p>El alta se hace con {@code INSERT ... ON CONFLICT DO NOTHING} apoyandose en
 * el indice unico {@code uq_visita_dedup (exhibicion_id, sesion_anonima_id,
 * fuente, ventana_inicio)}. Asi, varias interacciones del mismo visitante sobre
 * la misma exhibicion y fuente dentro del mismo minuto colapsan en una sola
 * fila sin generar errores por duplicado. La columna {@code ventana_inicio} la
 * calcula el trigger {@code trg_visita_ventana} en el propio INSERT, por lo que
 * se incluye en el destino del conflicto.</p>
 */
public interface VisitaRepository extends JpaRepository<Visita, Long> {

    /**
     * Registra una visita aplicando la deduplicacion de PostgreSQL.
     *
     * @return numero de filas insertadas (1 si fue nueva, 0 si era duplicada
     *         dentro de la misma ventana de deduplicacion).
     */
    @Modifying
    @Query(value = """
            INSERT INTO visita (exhibicion_id, sesion_anonima_id, fuente, valida, validada_en)
            VALUES (:exhibicionId, :sesionAnonimaId, :fuente, :valida, :validadaEn)
            ON CONFLICT (exhibicion_id, sesion_anonima_id, fuente, ventana_inicio) DO NOTHING
            """, nativeQuery = true)
    int registrarConDeduplicacion(@Param("exhibicionId") Long exhibicionId,
                                  @Param("sesionAnonimaId") UUID sesionAnonimaId,
                                  @Param("fuente") String fuente,
                                  @Param("valida") boolean valida,
                                  @Param("validadaEn") OffsetDateTime validadaEn);

    /**
     * Ranking completo de exhibiciones por popularidad (visitas validas),
     * descendente. Los empates se resuelven alfabeticamente por titulo.
     */
    @Query(value = """
            SELECT exhibicion_id, codigo, titulo, sala_id, sala_nombre, total_visitas_validas
            FROM v_ranking_exhibicion
            ORDER BY total_visitas_validas DESC, titulo ASC
            """, nativeQuery = true)
    List<RankingExhibicionView> findRankingCompleto();

    /**
     * Ranking limitado a las {@code limite} exhibiciones mas populares, con el
     * mismo orden y resolucion de empates que {@link #findRankingCompleto()}.
     */
    @Query(value = """
            SELECT exhibicion_id, codigo, titulo, sala_id, sala_nombre, total_visitas_validas
            FROM v_ranking_exhibicion
            ORDER BY total_visitas_validas DESC, titulo ASC
            LIMIT :limite
            """, nativeQuery = true)
    List<RankingExhibicionView> findRankingLimitado(@Param("limite") int limite);

    long countByExhibicionId(Long exhibicionId);

    long countByExhibicionIdAndValidaTrue(Long exhibicionId);

    /**
     * Elimina las visitas de una sesion anonima concreta. Se usa para limpiar
     * datos de pruebas de integracion de la base aislada, donde las visitas
     * creadas por la ingestion IoT se identifican por su sesion derivada del
     * mensaje que representa la transicion de presencia.
     */
    @Transactional
    long deleteBySesionAnonimaId(UUID sesionAnonimaId);
}
