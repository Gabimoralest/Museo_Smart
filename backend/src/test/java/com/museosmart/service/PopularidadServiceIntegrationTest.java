package com.museosmart.service;

import com.museosmart.entity.Exhibicion;
import com.museosmart.entity.Visita;
import com.museosmart.exception.RecursoNoEncontradoException;
import com.museosmart.exception.ReglaNegocioException;
import com.museosmart.repository.ExhibicionRepository;
import com.museosmart.repository.RankingExhibicionView;
import com.museosmart.repository.VisitaRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Prueba de INTEGRACION REAL del servicio de popularidad contra la base AISLADA
 * (museo_smart_test). Requiere RUN_DB_IT=true. Los tests son @Transactional y
 * se revierten al finalizar.
 *
 * <p>Verifica el comportamiento end-to-end: validacion de exhibicion activa,
 * deduplicacion real en PostgreSQL, marca explicita de valida y efecto en la
 * vista de ranking.</p>
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
class PopularidadServiceIntegrationTest {

    @Autowired
    private PopularidadService popularidadService;

    @Autowired
    private VisitaRepository visitaRepository;

    @Autowired
    private ExhibicionRepository exhibicionRepository;

    private Exhibicion unaExhibicionActiva() {
        return exhibicionRepository.findByActiva(true).get(0);
    }

    private long visitasValidasDe(Long exhibicionId) {
        return visitaRepository.countByExhibicionIdAndValidaTrue(exhibicionId);
    }

    @Test
    @DisplayName("registrar visita valida incrementa el ranking de esa exhibicion")
    void registrarVisita_incrementaRanking() {
        Exhibicion e = unaExhibicionActiva();
        long antes = visitasValidasDe(e.getId());

        boolean contabilizada = popularidadService.registrarVisita(
                e.getId(), UUID.randomUUID().toString(), Visita.FUENTE_CURSOR);

        assertThat(contabilizada).isTrue();
        assertThat(visitasValidasDe(e.getId())).isEqualTo(antes + 1);
    }

    @Test
    @DisplayName("dos interacciones identicas en la misma ventana se deduplican (una sola fila)")
    void registrarVisita_deduplicaMismaVentana() {
        Exhibicion e = unaExhibicionActiva();
        String sesion = UUID.randomUUID().toString();

        boolean primera = popularidadService.registrarVisita(e.getId(), sesion, Visita.FUENTE_CURSOR);
        boolean segunda = popularidadService.registrarVisita(e.getId(), sesion, Visita.FUENTE_CURSOR);

        assertThat(primera).isTrue();
        assertThat(segunda).isFalse();
    }

    @Test
    @DisplayName("exhibicion inactiva no admite visitas")
    void registrarVisita_exhibicionInactiva() {
        Exhibicion e = exhibicionRepository.findByActiva(true).get(0);
        e.setActiva(false);
        exhibicionRepository.saveAndFlush(e);

        assertThatThrownBy(() -> popularidadService.registrarVisita(
                e.getId(), UUID.randomUUID().toString(), Visita.FUENTE_CURSOR))
                .isInstanceOf(RecursoNoEncontradoException.class);
    }

    @Test
    @DisplayName("fuente invalida no persiste nada")
    void registrarVisita_fuenteInvalida() {
        Exhibicion e = unaExhibicionActiva();
        long antes = visitasValidasDe(e.getId());

        assertThatThrownBy(() -> popularidadService.registrarVisita(
                e.getId(), UUID.randomUUID().toString(), "NO_EXISTE"))
                .isInstanceOf(ReglaNegocioException.class);

        assertThat(visitasValidasDe(e.getId())).isEqualTo(antes);
    }

    @Test
    @DisplayName("el ranking respeta el orden por popularidad y empates alfabeticos")
    void ranking_ordenCorrecto() {
        List<RankingExhibicionView> ranking = popularidadService.rankingCompleto();
        assertThat(ranking).isNotEmpty();

        for (int i = 1; i < ranking.size(); i++) {
            RankingExhibicionView previa = ranking.get(i - 1);
            RankingExhibicionView actual = ranking.get(i);

            long vPrevia = previa.getTotalVisitasValidas();
            long vActual = actual.getTotalVisitasValidas();

            assertThat(vPrevia).isGreaterThanOrEqualTo(vActual);
            if (vPrevia == vActual) {
                assertThat(previa.getTitulo()).isLessThanOrEqualTo(actual.getTitulo());
            }
        }
    }
}
