-- Reglas de integridad que Prisma no puede expresar.
-- Esta migracion es personalizada: no hay cambios de esquema, solo reglas.
--
-- Nota sobre CHECKs en tablas con datos: si la tabla ya tuviera filas que
-- violaran la regla, el ALTER TABLE ... ADD CONSTRAINT fallaria. En ese caso
-- habria que anadir "NOT VALID" y despues ejecutar "VALIDATE CONSTRAINT" de
-- forma controlada.

-- =============================================================================
-- (a) INMUTABILIDAD DE registro_asistencia
--
-- Los registros de asistencia son la fuente de verdad del control de horas.
-- Un UPDATE permitiria reescribir el historico y un DELETE lo borraria, por lo
-- que la tabla se vuelve de solo insercion. Las correcciones se modelan
-- insertando un registro nuevo con es_correccion = true.
--
-- No se anade trigger para TRUNCATE a proposito: el enunciado lo excluye.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_registro_asistencia_es_inmutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Operacion % no permitida sobre la tabla registro_asistencia: los registros de asistencia son inmutables (id=%, empleado_id=%).',
        TG_OP,
        OLD.id,
        OLD.empleado_id;
END;
$$;

COMMENT ON FUNCTION fn_registro_asistencia_es_inmutable() IS
    'Bloquea UPDATE y DELETE sobre registro_asistencia para preservar el historico. Lanza excepcion de tipo P0001 (raise_exception).';

CREATE TRIGGER trg_registro_asistencia_inmutable
BEFORE UPDATE OR DELETE ON registro_asistencia
FOR EACH ROW
EXECUTE FUNCTION fn_registro_asistencia_es_inmutable();

-- =============================================================================
-- (b) UNA SOLA ALERTA ABIERTA POR INSUMO Y SUCURSAL
--
-- Indice unico parcial: mientras la alerta este "abierta" no puede existir otra
-- para el mismo insumo_sucursal. Al pasar a "resuelta" deja de contar y se
-- permite reabrir una nueva. NULL no se indexa, pero insumo_sucursal_id es
-- NOT NULL, asi que la unicidad es total.
-- =============================================================================

CREATE UNIQUE INDEX idx_alerta_stock_abierta_por_insumo_sucursal
    ON alerta_stock (insumo_sucursal_id)
    WHERE estado = 'abierta';

-- =============================================================================
-- (c) COHERENCIA DE LA ANULACION EN venta
--
-- Una venta anulada exige los tres datos de la anulacion; una venta completada
-- no admite ninguno de ellos.
-- =============================================================================

ALTER TABLE venta
    ADD CONSTRAINT chk_venta_anulacion_coherente
    CHECK (
        (
            estado = 'anulada'
            AND fecha_anulacion IS NOT NULL
            AND usuario_anulador_id IS NOT NULL
            AND motivo_anulacion IS NOT NULL
        )
        OR
        (
            estado = 'completada'
            AND fecha_anulacion IS NULL
            AND usuario_anulador_id IS NULL
            AND motivo_anulacion IS NULL
        )
    );

-- =============================================================================
-- (d) COHERENCIA DE alerta_stock
--
-- Una alerta resuelta tiene fecha de resolucion; una alerta abierta no la tiene.
-- =============================================================================

ALTER TABLE alerta_stock
    ADD CONSTRAINT chk_alerta_stock_fecha_resuelta_coherente
    CHECK (
        (estado = 'resuelta' AND fecha_resuelta IS NOT NULL)
        OR
        (estado = 'abierta' AND fecha_resuelta IS NULL)
    );

-- =============================================================================
-- (e) COHERENCIA DE LA CORRECCION EN registro_asistencia
--
-- Un registro marcado como correccion exige referencia, motivo y usuario
-- corrector; un registro normal no admite ninguno de los tres.
-- =============================================================================

ALTER TABLE registro_asistencia
    ADD CONSTRAINT chk_registro_asistencia_correccion_coherente
    CHECK (
        (
            es_correccion = true
            AND registro_original_id IS NOT NULL
            AND motivo IS NOT NULL
            AND usuario_corrector_id IS NOT NULL
        )
        OR
        (
            es_correccion = false
            AND registro_original_id IS NULL
            AND motivo IS NULL
            AND usuario_corrector_id IS NULL
        )
    );

-- =============================================================================
-- (f) CHECKs DE VALORES NO NEGATIVOS Y DE FECHAS COHERENTES
-- =============================================================================

-- Detalle de venta: no se admiten cantidades ni importes negativos.
ALTER TABLE venta_detalle
    ADD CONSTRAINT chk_venta_detalle_cantidad_positiva
    CHECK (cantidad > 0);

ALTER TABLE venta_detalle
    ADD CONSTRAINT chk_venta_detalle_precio_unitario_snapshot_no_negativo
    CHECK (precio_unitario_snapshot >= 0);

ALTER TABLE venta_detalle
    ADD CONSTRAINT chk_venta_detalle_subtotal_no_negativo
    CHECK (subtotal >= 0);

-- Precio de venta vigente del producto en la sucursal.
ALTER TABLE producto_sucursal_variante
    ADD CONSTRAINT chk_producto_sucursal_variante_precio_no_negativo
    CHECK (precio >= 0);

-- Umbral de stock minimo: negativo no tiene sentido como aviso de reposicion.
ALTER TABLE insumo_sucursal
    ADD CONSTRAINT chk_insumo_sucursal_stock_minimo_no_negativo
    CHECK (stock_minimo >= 0);

-- Un empleado no puede cesar antes de ser contratado.
ALTER TABLE empleado
    ADD CONSTRAINT chk_empleado_cese_posterior_a_contratacion
    CHECK (fecha_cese IS NULL OR fecha_cese >= fecha_contratacion);