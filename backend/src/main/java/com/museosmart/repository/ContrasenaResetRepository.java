package com.museosmart.repository;

import com.museosmart.entity.ContrasenaReset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Optional;

public interface ContrasenaResetRepository extends JpaRepository<ContrasenaReset, Long> {

    /**
     * Código vigente de un usuario (no usado y no invalidado). El índice único
     * parcial de la tabla garantiza que exista como máximo uno.
     */
    Optional<ContrasenaReset> findFirstByUsuarioAdminIdAndUsadoEnIsNullAndInvalidadoEnIsNullOrderByCreadoEnDesc(
            Long usuarioAdminId);

    /**
     * Invalida todos los códigos vigentes de un usuario. Se usa al emitir uno nuevo
     * para respetar el índice único parcial uq_reset_vigente_por_usuario.
     */
    @Modifying
    @Query("update ContrasenaReset c set c.invalidadoEn = :ahora "
            + "where c.usuarioAdmin.id = :id and c.usadoEn is null and c.invalidadoEn is null")
    int invalidarVigentes(@Param("id") Long usuarioAdminId, @Param("ahora") OffsetDateTime ahora);
}
