-- Migración para añadir las acciones y entidad de exportación a la auditoría
-- Ejecutar en cafeteria_db y cafeteria_test

-- 1. Añadir 'exportacion' al enum auditoria_entidad
ALTER TYPE auditoria_entidad ADD VALUE IF NOT EXISTS 'exportacion';

-- 2. Añadir 'exportacion_generada' y 'exportacion_fallida' al enum auditoria_accion
ALTER TYPE auditoria_accion ADD VALUE IF NOT EXISTS 'exportacion_generada';
ALTER TYPE auditoria_accion ADD VALUE IF NOT EXISTS 'exportacion_fallida';