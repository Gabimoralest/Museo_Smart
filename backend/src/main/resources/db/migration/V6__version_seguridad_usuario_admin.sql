-- ============================================================
-- Museo Smart - V6
-- Version de seguridad por usuario para revocacion de JWT.
--
-- token_version se incluye como claim 'tv' en cada JWT de acceso. Al validar
-- una peticion autenticada se compara 'tv' con este valor; si difiere (o el
-- token no incluye 'tv'), el token se rechaza. Asi, incrementar token_version
-- invalida inmediatamente todos los tokens emitidos antes del evento.
--
-- Migracion aditiva: no elimina ni altera columnas existentes. Los usuarios
-- existentes quedan en version 0.
-- ============================================================

ALTER TABLE usuario_admin
    ADD COLUMN token_version integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN usuario_admin.token_version IS
    'Version de seguridad; se incluye como claim tv en el JWT. Incrementarla invalida tokens previos.';
