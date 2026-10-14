-- Auditoria del sistema (solo insercion).
-- Una unica migracion con TODOS los enums definitivos (entidades y acciones)
-- para no tener que ampliarlos despues.

-- =============================================================================
-- (1) ENUMS DEFINITIVOS
-- =============================================================================

-- CreateEnum
CREATE TYPE "auditoria_entidad" AS ENUM (
  'usuario', 'empleado', 'sucursal', 'categoria', 'variante', 'producto',
  'oferta', 'insumo', 'insumo_sucursal', 'turno', 'asignacion', 'equipo'
);

-- CreateEnum
CREATE TYPE "auditoria_accion" AS ENUM (
  'usuario_creado', 'usuario_editado', 'usuario_rol_cambiado',
  'usuario_sucursal_cambiada', 'usuario_bloqueado', 'usuario_activado',
  'usuario_password_restablecida', 'usuario_password_cambiada',
  'permiso_concedido', 'permiso_revocado', 'permiso_restablecido',
  'empleado_creado', 'empleado_editado', 'empleado_cesado',
  'empleado_pin_regenerado',
  'sucursal_creada', 'sucursal_editada',
  'categoria_creada', 'categoria_editada', 'categoria_eliminada',
  'variante_creada', 'variante_editada', 'variante_eliminada',
  'producto_creado', 'producto_editado', 'producto_eliminado',
  'oferta_creada', 'oferta_precio_fijado', 'oferta_activada',
  'oferta_desactivada',
  'insumo_creado', 'insumo_editado', 'insumo_eliminado',
  'insumo_sucursal_creado', 'insumo_sucursal_stock_minimo_cambiado',
  'insumo_sucursal_activado', 'insumo_sucursal_descontinuado',
  'turno_creado', 'turno_editado',
  'asignacion_creada', 'asignacion_retirada',
  'equipo_creado', 'equipo_editado', 'equipo_estado_cambiado'
);

-- =============================================================================
-- (2) TABLA
-- =============================================================================

-- CreateTable
CREATE TABLE "auditoria" (
  "id"                   UUID NOT NULL,
  "entidad"              "auditoria_entidad" NOT NULL,
  -- Referencia polimorfica (usuario/empleado/producto/...); sin FK.
  "entidad_id"           UUID NOT NULL,
  "accion"               "auditoria_accion" NOT NULL,
  "actor_id"             UUID NOT NULL,
  -- Solo en eventos de usuario, permiso y empleado (usuario vinculado).
  "usuario_afectado_id"  UUID,
  -- NULL en eventos globales (catalogo de productos, categorias, variantes,
  -- insumos, sucursales).
  "sucursal_afectada_id" UUID,
  "detalle"              JSONB NOT NULL DEFAULT '{}',
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- =============================================================================
-- (3) INDICES
-- =============================================================================

-- CreateIndex — historial de una entidad concreta
CREATE INDEX "auditoria_entidad_entidad_id_created_at_idx"
  ON "auditoria" ("entidad", "entidad_id", "created_at" DESC);

-- CreateIndex — historial de un usuario afectado
CREATE INDEX "auditoria_usuario_afectado_id_created_at_idx"
  ON "auditoria" ("usuario_afectado_id", "created_at" DESC);

-- CreateIndex — listado general por fecha, con desempate estable por id
CREATE INDEX "auditoria_created_at_id_idx"
  ON "auditoria" ("created_at" DESC, "id" DESC);

-- CreateIndex — filtro por actor
CREATE INDEX "auditoria_actor_id_created_at_idx"
  ON "auditoria" ("actor_id", "created_at" DESC);

-- CreateIndex — filtro por accion
CREATE INDEX "auditoria_accion_created_at_idx"
  ON "auditoria" ("accion", "created_at" DESC);

-- CreateIndex — filtro por sucursal afectada
CREATE INDEX "auditoria_sucursal_afectada_id_created_at_idx"
  ON "auditoria" ("sucursal_afectada_id", "created_at" DESC);

-- =============================================================================
-- (4) CLAVES FORANEAS
-- =============================================================================

-- AddForeignKey
ALTER TABLE "auditoria"
  ADD CONSTRAINT "auditoria_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "usuario"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria"
  ADD CONSTRAINT "auditoria_usuario_afectado_id_fkey"
  FOREIGN KEY ("usuario_afectado_id") REFERENCES "usuario"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria"
  ADD CONSTRAINT "auditoria_sucursal_afectada_id_fkey"
  FOREIGN KEY ("sucursal_afectada_id") REFERENCES "sucursal"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- (5) INMUTABILIDAD (solo insercion) — mismo patron que registro_asistencia
--
-- UPDATE y DELETE lanzan P0001 (raise_exception). No se cubre TRUNCATE a
-- proposito (igual que registro_asistencia): el helper de pruebas vacia las
-- tablas con TRUNCATE y debe poder seguir haciendolo.
-- =============================================================================

-- CreateFunction
CREATE OR REPLACE FUNCTION fn_auditoria_es_inmutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'Operacion % no permitida sobre la tabla auditoria: los registros de auditoria son inmutables (id=%, entidad=%, accion=%).',
    TG_OP,
    OLD.id,
    OLD.entidad,
    OLD.accion;
END;
$$;

COMMENT ON FUNCTION fn_auditoria_es_inmutable() IS
  'Bloquea UPDATE y DELETE sobre auditoria para preservar el rastro. Lanza excepcion de tipo P0001 (raise_exception).';

-- CreateTrigger
CREATE TRIGGER trg_auditoria_inmutable
BEFORE UPDATE OR DELETE ON "auditoria"
FOR EACH ROW
EXECUTE FUNCTION fn_auditoria_es_inmutable();

-- =============================================================================
-- (6) DOCUMENTACION DE TABLAS HEREDADAS
-- =============================================================================

COMMENT ON TABLE "auditoria" IS
  'Rastro de auditoria de solo insercion. Tablas heredadas complementarias: historial_permisos e historial_equipo se mantienen tal cual (escritura doble en permisos y equipos); la lectura del historial sale SOLO de auditoria.';

COMMENT ON COLUMN "auditoria"."detalle" IS
  'JSONB {antes, despues}. Nunca contiene contrasenas, hashes ni PIN; pasa por un sanitizador de claves prohibidas antes de escribirse.';
