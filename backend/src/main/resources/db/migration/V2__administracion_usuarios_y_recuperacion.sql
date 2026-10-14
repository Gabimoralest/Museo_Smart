-- ============================================================
-- Museo Smart - V2
-- Administracion: usuarios administrativos y recuperacion de contrasena.
-- Depende de V1 (se agrega aqui la FK de exhibicion_estado_historial.cambiado_por).
-- ============================================================

-- ------------------------------------------------------------
-- Tabla: usuario_admin
-- Unicos usuarios autenticados del sistema. Contrasena siempre en hash (BCrypt).
-- ------------------------------------------------------------
CREATE TABLE usuario_admin (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre            varchar(120) NOT NULL,
    correo            varchar(254) NOT NULL,
    hash_contrasena   varchar(255) NOT NULL,
    rol               varchar(20)  NOT NULL,
    estado            varchar(20)  NOT NULL DEFAULT 'ACTIVO',
    primer_inicio_sesion boolean   NOT NULL DEFAULT true,
    ultimo_acceso_en  timestamptz,
    creado_en         timestamptz  NOT NULL DEFAULT now(),
    actualizado_en    timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT ck_usuario_rol    CHECK (rol IN ('SUPERADMIN', 'ADMIN')),
    CONSTRAINT ck_usuario_estado CHECK (estado IN ('ACTIVO', 'INACTIVO', 'BLOQUEADO'))
);

COMMENT ON TABLE  usuario_admin                   IS 'Usuarios administrativos (SUPERADMIN y ADMIN). Sin visitantes registrados.';
COMMENT ON COLUMN usuario_admin.hash_contrasena   IS 'Hash BCrypt; nunca se almacena la contrasena en texto plano.';
COMMENT ON COLUMN usuario_admin.primer_inicio_sesion IS 'true hasta que el usuario cambie su contrasena temporal.';

-- Correo unico sin distinguir mayusculas/minusculas (sin depender de citext).
CREATE UNIQUE INDEX uq_usuario_admin_correo_lower ON usuario_admin (lower(correo));
CREATE INDEX idx_usuario_admin_rol    ON usuario_admin (rol);
CREATE INDEX idx_usuario_admin_estado ON usuario_admin (estado);

CREATE TRIGGER trg_usuario_admin_actualizado_en
    BEFORE UPDATE ON usuario_admin
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();

-- FK diferida desde V1: historial de estado -> usuario responsable.
ALTER TABLE exhibicion_estado_historial
    ADD CONSTRAINT fk_historial_usuario
    FOREIGN KEY (cambiado_por) REFERENCES usuario_admin(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- Tabla: contrasena_reset
-- Codigos temporales de recuperacion. Se guarda el hash del codigo, nunca el codigo.
-- ------------------------------------------------------------
CREATE TABLE contrasena_reset (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_admin_id bigint      NOT NULL REFERENCES usuario_admin(id) ON DELETE CASCADE,
    codigo_hash      varchar(255) NOT NULL,
    expira_en        timestamptz  NOT NULL,
    usado_en         timestamptz,
    invalidado_en    timestamptz,
    intentos         smallint     NOT NULL DEFAULT 0,
    creado_en        timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT ck_reset_intentos CHECK (intentos >= 0)
);

COMMENT ON TABLE  contrasena_reset            IS 'Codigos temporales de recuperacion; se almacena solo el hash del codigo.';
COMMENT ON COLUMN contrasena_reset.usado_en   IS 'Marca de uso unico; un codigo usado ya no es valido.';
COMMENT ON COLUMN contrasena_reset.invalidado_en IS 'Marca de invalidacion al emitir un codigo nuevo.';

CREATE INDEX idx_reset_usuario ON contrasena_reset (usuario_admin_id);

-- Un solo codigo vigente por usuario: se consideran vigentes los no usados e
-- invalidados. Al emitir uno nuevo, el flujo Java debe invalidar los anteriores;
-- este indice lo garantiza a nivel de datos.
CREATE UNIQUE INDEX uq_reset_vigente_por_usuario
    ON contrasena_reset (usuario_admin_id)
    WHERE usado_en IS NULL AND invalidado_en IS NULL;
