-- Etapa 1 del bloque de personal.
--
-- (a) empleado.pin_hash: PIN de marcacion (bcrypt). Nullable: sin PIN el
--     empleado no puede marcar.
-- (b) turno.hora_inicio / turno.hora_fin: pasan a NULLABLE porque un turno
--     variable puede no tener franja horaria definida.
-- (c) justificacion_falta: tabla de solo insercion, con trigger de
--     inmutabilidad (mismo criterio que registro_asistencia).
--
-- (a), (b) y la tabla de (c) son el diff generado por Prisma a partir de
-- schema.prisma. El trigger de (c) es SQL a mano: Prisma no puede expresarlo.

-- AlterTable
ALTER TABLE "empleado" ADD COLUMN "pin_hash" TEXT;

-- AlterTable
ALTER TABLE "turno" ALTER COLUMN "hora_inicio" DROP NOT NULL,
ALTER COLUMN "hora_fin" DROP NOT NULL;

-- CreateTable
CREATE TABLE "justificacion_falta" (
    "id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "motivo" TEXT NOT NULL,
    "usuario_justificador_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "justificacion_falta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "justificacion_falta_empleado_id_fecha_key" ON "justificacion_falta"("empleado_id", "fecha");

-- AddForeignKey
ALTER TABLE "justificacion_falta" ADD CONSTRAINT "justificacion_falta_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "justificacion_falta" ADD CONSTRAINT "justificacion_falta_usuario_justificador_id_fkey" FOREIGN KEY ("usuario_justificador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Inmutabilidad de justificacion_falta (SQL a mano).
-- Una justificacion de falta es un hecho historico: solo se inserta. Cualquier
-- UPDATE o DELETE lanza una excepcion P0001 (raise_exception). Mismo criterio
-- que el trigger de registro_asistencia. TRUNCATE no se cubre a proposito: no
-- es una operacion soportada por la aplicacion.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_justificacion_falta_es_inmutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Operacion % no permitida sobre la tabla justificacion_falta: las justificaciones son inmutables (id=%, empleado_id=%).',
        TG_OP,
        OLD.id,
        OLD.empleado_id;
END;
$$;

COMMENT ON FUNCTION fn_justificacion_falta_es_inmutable() IS
    'Bloquea UPDATE y DELETE sobre justificacion_falta para preservar el historico. Lanza excepcion de tipo P0001 (raise_exception).';

CREATE TRIGGER trg_justificacion_falta_inmutable
BEFORE UPDATE OR DELETE ON justificacion_falta
FOR EACH ROW
EXECUTE FUNCTION fn_justificacion_falta_es_inmutable();
