package com.museosmart.repository;

import com.museosmart.entity.Exhibicion;
import com.museosmart.entity.Visita;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Prueba de INTEGRACION REAL de la persistencia de popularidad contra la base
 * AISLADA (museo_smart_test), nunca la de desarrollo. Requiere RUN_DB_IT=true.
 *
 * <p>Verifica que el mapeo JPA de {@link Visita} coincide con la tabla {@code
 * visita} (V3), que la deduplicacion por {@code uq_visita_dedup} funciona al
 * registrar con {@code ON CONFLICT DO NOTHING}, y que la vista
 * {@code v_ranking_exhibicion} se proyecta correctamente.</p>
 *
 * <p>Todos los metodos son {@code @Transactional}: los datos se revierten.</p>
 */
@SpringBootTest
@EnabledIfEnvironmentVariable(named = "RUN_DB_IT", matches = "true")
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:postgresql://localhost:5432/museo_smart_test",
        "spring.datasource.username=postgres",
        "spring.datasource.password=${DB_PASSWORD:}",
        "spring.jpa.hibernate.ddl-auto=validate",
        "spring.flyway.enabled=true",
        "app.mail.habilitado=false",
        "app.iot.mqtt.enabled=false",
        "app.iot.influx.enabled=false",
        "app.security.jwt.secret=clave-de-prueba-integracion-suficientemente-larga-1234567890"
})
@Transactional
class VisitaRepositoryIntegrationTest {

    @Autowired
    private VisitaRepository visitaRepository;

    @Autowired
    private ExhibicionRepository exhibicionRepository;

    private Exhibicion unaExhibicionActiva() {
        return exhibicionRepository.findByActiva(true).get(0);
    }

    @Test
    @DisplayName("registra una visita valida nueva (1 fila insertada)")
    void registraVisitaNueva() {
        Exhibicion e = unaExhibicionActiva();
        UUID sesion = UUID.randomUUID();
        long filasAntes = visitaRepository.countByExhibicionId(e.getId());
        long validasAntes = totalValidasEnRanking(e.getId());

        int insertadas = visitaRepository.registrarConDeduplicacion(
                e.getId(), sesion, Visita.FUENTE_CURSOR, true, OffsetDateTime.now());

        assertThat(insertadas).isEqualTo(1);
        assertThat(visitaRepository.countByExhibicionId(e.getId())).isEqualTo(filasAntes + 1);
        assertThat(totalValidasEnRanking(e.getId())).isEqualTo(validasAntes + 1);
    }

    @Test
    @DisplayName("deduplica: misma sesion, exhibicion y fuente dentro del mismo minuto no inserta otra fila")
    void deduplicaMismaVentana() {
        Exhibicion e = unaExhibicionActiva();
        UUID sesion = UUID.randomUUID();
        long antes = visitaRepository.countByExhibicionId(e.getId());

        int primera = visitaRepository.registrarConDeduplicacion(
                e.getId(), sesion, Visita.FUENTE_CURSOR, true, OffsetDateTime.now());
        int segunda = visitaRepository.registrarConDeduplicacion(
                e.getId(), sesion, Visita.FUENTE_CURSOR, true, OffsetDateTime.now());

        assertThat(primera).isEqualTo(1);
        assertThat(segunda).isZero();
        assertThat(visitaRepository.countByExhibicionId(e.getId())).isEqualTo(antes + 1);
    }

    @Test
    @DisplayName("sesiones anonimas distintas cuentan como interacciones distintas")
    void sesionesDistintasCuentan() {
        Exhibicion e = unaExhibicionActiva();
        long antes = visitaRepository.countByExhibicionId(e.getId());

        visitaRepository.registrarConDeduplicacion(
                e.getId(), UUID.randomUUID(), Visita.FUENTE_CURSOR, true, OffsetDateTime.now());
        visitaRepository.registrarConDeduplicacion(
                e.getId(), UUID.randomUUID(), Visita.FUENTE_CURSOR, true, OffsetDateTime.now());

        assertThat(visitaRepository.countByExhibicionId(e.getId())).isEqualTo(antes + 2);
    }

    @Test
    @DisplayName("la vista de ranking se proyecta y refleja las visitas validas")
    void rankingReflejaVisitasValidas() {
        Exhibicion e = unaExhibicionActiva();
        long validasAntes = totalValidasEnRanking(e.getId());

        // Una valida y una NO valida: solo la valida debe contar.
        visitaRepository.registrarConDeduplicacion(
                e.getId(), UUID.randomUUID(), Visita.FUENTE_CURSOR, true, OffsetDateTime.now());
        visitaRepository.registrarConDeduplicacion(
                e.getId(), UUID.randomUUID(), Visita.FUENTE_CURSOR, false, null);

        List<RankingExhibicionView> ranking = visitaRepository.findRankingCompleto();
        assertThat(ranking).isNotEmpty();

        RankingExhibicionView fila = ranking.stream()
                .filter(r -> r.getExhibicionId().equals(e.getId()))
                .findFirst()
                .orElseThrow();

        assertThat(fila.getCodigo()).isEqualTo(e.getCodigo());
        assertThat(fila.getTitulo()).isEqualTo(e.getTitulo());
        assertThat(fila.getSalaId()).isEqualTo(e.getSala().getId());
        assertThat(fila.getSalaNombre()).isEqualTo(e.getSala().getNombre());
        assertThat(fila.getTotalVisitasValidas()).isEqualTo(validasAntes + 1);
    }

    /** Visitas validas de la exhibicion segun la vista de ranking (incluye confirmadas). */
    private long totalValidasEnRanking(Long exhibicionId) {
        return visitaRepository.findRankingCompleto().stream()
                .filter(r -> r.getExhibicionId().equals(exhibicionId))
                .mapToLong(RankingExhibicionView::getTotalVisitasValidas)
                .sum();
    }

    @Test
    @DisplayName("el ranking limitado devuelve como maximo el numero solicitado")
    void rankingLimitado() {
        List<RankingExhibicionView> tres = visitaRepository.findRankingLimitado(3);
        assertThat(tres).hasSizeLessThanOrEqualTo(3);
    }
}
