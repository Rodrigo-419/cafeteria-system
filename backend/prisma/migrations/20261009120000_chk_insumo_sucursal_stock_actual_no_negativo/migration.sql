-- CHECK de stock actual no negativo.
--
-- El stock fisico no puede ser negativo: un valor asi no representa ninguna
-- situacion real y, de permitirlo, las alertas de reposicion y los recuentos
-- partirian de una cifra inconsistente.
--
-- Nota sobre CHECKs en tablas con datos: si la tabla ya tuviera filas que
-- violaran la regla, el ALTER TABLE ... ADD CONSTRAINT fallaria. En ese caso
-- habria que anadir "NOT VALID" y despues ejecutar "VALIDATE CONSTRAINT" de
-- forma controlada.

ALTER TABLE insumo_sucursal
    ADD CONSTRAINT chk_insumo_sucursal_stock_actual_no_negativo
    CHECK (stock_actual >= 0);