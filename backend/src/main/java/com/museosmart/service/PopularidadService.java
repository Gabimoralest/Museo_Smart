package com.museosmart.service;

import com.museosmart.entity.Exhibicion;
import com.museosmart.entity.Visita;
import com.museosmart.exception.ReglaNegocioException;
import com.museosmart.repository.RankingExhibicionView;
import com.museosmart.repository.VisitaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Modulo de Popularidad y Analitica.
 *
 * <p>Registra interacciones anonimas de visitantes con exhibiciones y expone el
 * ranking de popularidad calculado en la vista {@code v_ranking_exhibicion}
 * (V3). No depende de Redis: la fuente de verdad es PostgreSQL.</p>
 *
 * <h2>Regla de negocio de {@code valida}</h2>
 * <p>Una visita se persiste como {@code valida = true} unicamente cuando cumple
 * TODAS estas condiciones, comprobadas por el backend:</p>
 * <ol>
 *   <li>La exhibicion existe y esta activa (se delega en
 *       {@link ExhibicionService#obtenerActivaPorId(Long)}, que trata una
 *       exhibicion inexistente o inactiva como no encontrada).</li>
 *   <li>La {@code fuente} pertenece al conjunto permitido por
 *       {@code ck_visita_fuente}.</li>
 *   <li>La {@code sesion_anonima_id} es un UUID valido (aportado por el cliente
 *       o generado por el backend).</li>
 * </ol>
 * <p>Las entradas que no cumplen estas condiciones se rechazan con una
 * excepcion y NO se persisten, por lo que toda fila almacenada ha superado la
 * validacion y cuenta para el ranking. No se marca {@code valida} por defecto
 * ni se confia en un valor enviado por el cliente. El detalle del motivo de
 * invalidez se reserva para futuros flujos de cuarentena; hoy no se usa porque
 * lo invalido se rechaza antes de insertar.</p>
 *
 * <h2>Sesion anonima</h2>
 * <p>Identificador opaco sin datos personales. Si el cliente no lo aporta o
 * llega vacio, el backend genera un UUID aleatorio. Si llega con formato
 * invalido, se rechaza. Es la clave que, junto a la exhibicion, la fuente y la
 * ventana de 1 minuto, usa el indice {@code uq_visita_dedup} para evitar
 * duplicados.</p>
 */
@Service
@Transactional(readOnly = true)
public class PopularidadService {

    private static final Logger log = LoggerFactory.getLogger(PopularidadService.class);

    /** Formatos de UUID aceptados (con o sin guiones de la forma canonica). */
    private static final Pattern UUID_ESTRICTO = Pattern.compile(
            "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");

    /** Fuentes permitidas, alineadas con la restriccion ck_visita_fuente de V3. */
    private static final Set<String> FUENTES_PERMITIDAS = Set.of(
            Visita.FUENTE_CURSOR,
            Visita.FUENTE_SIMULADOR,
            Visita.FUENTE_SENSOR,
            Visita.FUENTE_QR,
            Visita.FUENTE_OTRO);

    private final VisitaRepository visitaRepository;
    private final ExhibicionService exhibicionService;

    public PopularidadService(VisitaRepository visitaRepository, ExhibicionService exhibicionService) {
        this.visitaRepository = visitaRepository;
        this.exhibicionService = exhibicionService;
    }

    /**
     * Registra una interaccion publica con una exhibicion activa.
     *
     * <p>La deduplicacion la aplica PostgreSQL mediante
     * {@code ON CONFLICT DO NOTHING} sobre {@code uq_visita_dedup}: si ya existe
     * una visita de la misma sesion, exhibicion y fuente dentro del mismo minuto,
     * no se inserta otra fila y no se lanza ningun error.</p>
     *
     * @param exhibicionId     id de la exhibicion (debe existir y estar activa)
     * @param sesionAnonimaId  UUID opaco de sesion; puede ser null/vacio, en cuyo
     *                         caso el backend genera uno nuevo
     * @param fuente           origen de la interaccion (CURSOR, SIMULADOR,
     *                         SENSOR, QR u OTRO)
     * @return {@code true} si la interaccion se contabilizo (fila nueva);
     *         {@code false} si fue deduplicada por una existente en la misma
     *         ventana
     * @throws com.museosmart.exception.RecursoNoEncontradoException si la
     *         exhibicion no existe o no esta activa
     * @throws ReglaNegocioException si la fuente no es valida o la sesion
     *         anonima tiene un formato invalido
     */
    @Transactional
    public boolean registrarVisita(Long exhibicionId, String sesionAnonimaId, String fuente) {
        Exhibicion exhibicion = exhibicionService.obtenerActivaPorId(exhibicionId);

        String fuenteNormalizada = validarFuente(fuente);
        UUID sesion = resolverSesionAnonima(sesionAnonimaId);

        int insertadas = visitaRepository.registrarConDeduplicacion(
                exhibicion.getId(),
                sesion,
                fuenteNormalizada,
                true,
                OffsetDateTime.now());

        if (insertadas == 1) {
            log.debug("Visita contabilizada: exhibicion={}, fuente={}", exhibicion.getCodigo(), fuenteNormalizada);
            return true;
        }
        log.debug("Visita deduplicada (misma ventana): exhibicion={}, fuente={}",
                exhibicion.getCodigo(), fuenteNormalizada);
        return false;
    }

    /** Ranking completo por popularidad (visitas validas), con empates alfabeticos. */
    public List<RankingExhibicionView> rankingCompleto() {
        return visitaRepository.findRankingCompleto();
    }

    /**
     * Ranking limitado a las {@code limite} exhibiciones mas populares.
     *
     * @throws ReglaNegocioException si {@code limite} no es mayor que cero
     */
    public List<RankingExhibicionView> rankingLimitado(int limite) {
        if (limite <= 0) {
            throw new ReglaNegocioException("El limite del ranking debe ser mayor que cero");
        }
        return visitaRepository.findRankingLimitado(limite);
    }

    private String validarFuente(String fuente) {
        if (fuente == null || fuente.isBlank()) {
            throw new ReglaNegocioException("La fuente es obligatoria");
        }
        String normalizada = fuente.trim().toUpperCase();
        if (!FUENTES_PERMITIDAS.contains(normalizada)) {
            throw new ReglaNegocioException(
                    "Fuente inválida: " + fuente + ". Valores permitidos: " + FUENTES_PERMITIDAS);
        }
        return normalizada;
    }

    private UUID resolverSesionAnonima(String sesionAnonimaId) {
        if (sesionAnonimaId == null || sesionAnonimaId.isBlank()) {
            return UUID.randomUUID();
        }
        String candidato = sesionAnonimaId.trim();
        if (!UUID_ESTRICTO.matcher(candidato).matches()) {
            throw new ReglaNegocioException("El identificador de sesión anónima no es un UUID válido");
        }
        return UUID.fromString(candidato);
    }
}
