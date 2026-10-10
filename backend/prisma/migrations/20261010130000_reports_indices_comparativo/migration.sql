-- Indices de apoyo a las consultas del reporte comparativo.
--
-- Migracion solo de indices: no toca datos ni columnas. Ambos se apoyan en
-- filtros que el reporte hace sobre un rango de fechas.
--
--   * `venta(estado, created_at)`: el reporte filtra por estado (completada o
--     anulada) y por `created_at` en el periodo. El indice existente
--     `venta(sucursal_id, created_at)` no sirve cuando se piden todas las
--     sucursales, porque no empieza por sucursal.
--   * `justificacion_falta(fecha)`: el conteo de justificaciones del periodo
--     filtra por la columna `fecha`; el unico existente empieza por
--     `empleado_id`.
CREATE INDEX "venta_estado_created_at_idx" ON "venta"("estado", "created_at");
CREATE INDEX "justificacion_falta_fecha_idx" ON "justificacion_falta"("fecha");
