-- CreateEnum
CREATE TYPE "usuario_estado" AS ENUM ('activo', 'bloqueado');

-- CreateEnum
CREATE TYPE "usuario_permiso_tipo" AS ENUM ('concedido', 'revocado');

-- CreateEnum
CREATE TYPE "historial_permisos_accion" AS ENUM ('asignado', 'revocado');

-- CreateEnum
CREATE TYPE "empleado_estado" AS ENUM ('activo', 'inactivo');

-- CreateEnum
CREATE TYPE "turno_tipo" AS ENUM ('fijo', 'variable');

-- CreateEnum
CREATE TYPE "registro_asistencia_tipo" AS ENUM ('entrada', 'salida');

-- CreateEnum
CREATE TYPE "producto_sucursal_variante_estado" AS ENUM ('activo', 'inactivo');

-- CreateEnum
CREATE TYPE "insumo_presentacion" AS ENUM ('paquete', 'bolsa', 'caja', 'unidad', 'paquete_varias_unidades');

-- CreateEnum
CREATE TYPE "insumo_sucursal_estado" AS ENUM ('activo', 'descontinuado');

-- CreateEnum
CREATE TYPE "movimiento_inventario_tipo" AS ENUM ('entrada', 'ajuste');

-- CreateEnum
CREATE TYPE "alerta_stock_estado" AS ENUM ('abierta', 'resuelta');

-- CreateEnum
CREATE TYPE "venta_metodo_pago" AS ENUM ('efectivo', 'tarjeta');

-- CreateEnum
CREATE TYPE "venta_estado" AS ENUM ('completada', 'anulada');

-- CreateEnum
CREATE TYPE "equipo_estado" AS ENUM ('funcionando', 'danado', 'en_mantenimiento', 'retirado');

-- CreateTable
CREATE TABLE "sucursal" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "telefono" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sucursal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permiso" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol_permiso" (
    "rol_id" UUID NOT NULL,
    "permiso_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rol_permiso_pkey" PRIMARY KEY ("rol_id","permiso_id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol_id" UUID NOT NULL,
    "sucursal_id" UUID,
    "estado" "usuario_estado" NOT NULL DEFAULT 'activo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_permiso" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "permiso_id" UUID NOT NULL,
    "tipo" "usuario_permiso_tipo" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_permiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_permisos" (
    "id" UUID NOT NULL,
    "usuario_afectado_id" UUID NOT NULL,
    "permiso_id" UUID NOT NULL,
    "accion" "historial_permisos_accion" NOT NULL,
    "usuario_ejecutor_id" UUID NOT NULL,
    "valor_anterior" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empleado" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "cargo" TEXT NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "fecha_contratacion" DATE NOT NULL,
    "fecha_cese" DATE,
    "estado" "empleado_estado" NOT NULL DEFAULT 'activo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turno" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "tipo" "turno_tipo" NOT NULL,
    "hora_inicio" TIME NOT NULL,
    "hora_fin" TIME NOT NULL,
    "dias_semana" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignacion_turno" (
    "id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "turno_id" UUID NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asignacion_turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registro_asistencia" (
    "id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "tipo" "registro_asistencia_tipo" NOT NULL,
    "fecha_hora" TIMESTAMP(3) NOT NULL,
    "metodo" TEXT NOT NULL,
    "es_correccion" BOOLEAN NOT NULL DEFAULT false,
    "registro_original_id" UUID,
    "motivo" TEXT,
    "usuario_corrector_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registro_asistencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categoria_producto" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categoria_producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producto" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria_id" UUID NOT NULL,
    "descripcion" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variante" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "variante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producto_sucursal_variante" (
    "id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "variante_id" UUID NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,
    "estado" "producto_sucursal_variante_estado" NOT NULL DEFAULT 'activo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "producto_sucursal_variante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insumo" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "presentacion" "insumo_presentacion" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insumo_sucursal" (
    "id" UUID NOT NULL,
    "insumo_id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "stock_actual" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "stock_minimo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estado" "insumo_sucursal_estado" NOT NULL DEFAULT 'activo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insumo_sucursal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimiento_inventario" (
    "id" UUID NOT NULL,
    "insumo_sucursal_id" UUID NOT NULL,
    "tipo" "movimiento_inventario_tipo" NOT NULL,
    "cantidad" DECIMAL(12,2) NOT NULL,
    "usuario_id" UUID NOT NULL,
    "motivo" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimiento_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recuento_inventario" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recuento_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recuento_inventario_detalle" (
    "id" UUID NOT NULL,
    "recuento_id" UUID NOT NULL,
    "insumo_sucursal_id" UUID NOT NULL,
    "stock_sistema" DECIMAL(12,2) NOT NULL,
    "stock_fisico" DECIMAL(12,2) NOT NULL,
    "diferencia" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recuento_inventario_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerta_stock" (
    "id" UUID NOT NULL,
    "insumo_sucursal_id" UUID NOT NULL,
    "estado" "alerta_stock_estado" NOT NULL DEFAULT 'abierta',
    "fecha_resuelta" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerta_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venta" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "metodo_pago" "venta_metodo_pago" NOT NULL,
    "estado" "venta_estado" NOT NULL DEFAULT 'completada',
    "fecha_anulacion" TIMESTAMP(3),
    "usuario_anulador_id" UUID,
    "motivo_anulacion" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venta_detalle" (
    "id" UUID NOT NULL,
    "venta_id" UUID NOT NULL,
    "producto_sucursal_variante_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario_snapshot" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venta_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipo" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "estado" "equipo_estado" NOT NULL DEFAULT 'funcionando',
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_equipo" (
    "id" UUID NOT NULL,
    "equipo_id" UUID NOT NULL,
    "estado_anterior" "equipo_estado" NOT NULL,
    "estado_nuevo" "equipo_estado" NOT NULL,
    "observaciones_anterior" TEXT,
    "observaciones_nuevas" TEXT,
    "usuario_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_equipo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sucursal_nombre_key" ON "sucursal"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "rol_nombre_key" ON "rol"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "permiso_codigo_key" ON "permiso"("codigo");

-- CreateIndex
CREATE INDEX "rol_permiso_permiso_id_idx" ON "rol_permiso"("permiso_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "usuario_rol_id_idx" ON "usuario"("rol_id");

-- CreateIndex
CREATE INDEX "usuario_sucursal_id_idx" ON "usuario"("sucursal_id");

-- CreateIndex
CREATE INDEX "usuario_permiso_permiso_id_idx" ON "usuario_permiso"("permiso_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_permiso_usuario_id_permiso_id_key" ON "usuario_permiso"("usuario_id", "permiso_id");

-- CreateIndex
CREATE INDEX "historial_permisos_usuario_afectado_id_idx" ON "historial_permisos"("usuario_afectado_id");

-- CreateIndex
CREATE INDEX "historial_permisos_permiso_id_idx" ON "historial_permisos"("permiso_id");

-- CreateIndex
CREATE INDEX "historial_permisos_usuario_ejecutor_id_idx" ON "historial_permisos"("usuario_ejecutor_id");

-- CreateIndex
CREATE INDEX "historial_permisos_usuario_afectado_id_created_at_idx" ON "historial_permisos"("usuario_afectado_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "empleado_usuario_id_key" ON "empleado"("usuario_id");

-- CreateIndex
CREATE INDEX "empleado_sucursal_id_idx" ON "empleado"("sucursal_id");

-- CreateIndex
CREATE INDEX "turno_sucursal_id_idx" ON "turno"("sucursal_id");

-- CreateIndex
CREATE INDEX "asignacion_turno_empleado_id_idx" ON "asignacion_turno"("empleado_id");

-- CreateIndex
CREATE INDEX "asignacion_turno_turno_id_idx" ON "asignacion_turno"("turno_id");

-- CreateIndex
CREATE INDEX "registro_asistencia_empleado_id_idx" ON "registro_asistencia"("empleado_id");

-- CreateIndex
CREATE INDEX "registro_asistencia_sucursal_id_idx" ON "registro_asistencia"("sucursal_id");

-- CreateIndex
CREATE INDEX "registro_asistencia_registro_original_id_idx" ON "registro_asistencia"("registro_original_id");

-- CreateIndex
CREATE INDEX "registro_asistencia_usuario_corrector_id_idx" ON "registro_asistencia"("usuario_corrector_id");

-- CreateIndex
CREATE INDEX "registro_asistencia_empleado_id_fecha_hora_idx" ON "registro_asistencia"("empleado_id", "fecha_hora");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_producto_nombre_key" ON "categoria_producto"("nombre");

-- CreateIndex
CREATE INDEX "producto_categoria_id_idx" ON "producto"("categoria_id");

-- CreateIndex
CREATE UNIQUE INDEX "variante_nombre_key" ON "variante"("nombre");

-- CreateIndex
CREATE INDEX "producto_sucursal_variante_producto_id_idx" ON "producto_sucursal_variante"("producto_id");

-- CreateIndex
CREATE INDEX "producto_sucursal_variante_sucursal_id_idx" ON "producto_sucursal_variante"("sucursal_id");

-- CreateIndex
CREATE INDEX "producto_sucursal_variante_variante_id_idx" ON "producto_sucursal_variante"("variante_id");

-- CreateIndex
CREATE UNIQUE INDEX "producto_sucursal_variante_producto_id_sucursal_id_variante_key" ON "producto_sucursal_variante"("producto_id", "sucursal_id", "variante_id");

-- CreateIndex
CREATE INDEX "insumo_sucursal_insumo_id_idx" ON "insumo_sucursal"("insumo_id");

-- CreateIndex
CREATE INDEX "insumo_sucursal_sucursal_id_idx" ON "insumo_sucursal"("sucursal_id");

-- CreateIndex
CREATE UNIQUE INDEX "insumo_sucursal_insumo_id_sucursal_id_key" ON "insumo_sucursal"("insumo_id", "sucursal_id");

-- CreateIndex
CREATE INDEX "movimiento_inventario_insumo_sucursal_id_idx" ON "movimiento_inventario"("insumo_sucursal_id");

-- CreateIndex
CREATE INDEX "movimiento_inventario_usuario_id_idx" ON "movimiento_inventario"("usuario_id");

-- CreateIndex
CREATE INDEX "movimiento_inventario_insumo_sucursal_id_created_at_idx" ON "movimiento_inventario"("insumo_sucursal_id", "created_at");

-- CreateIndex
CREATE INDEX "recuento_inventario_sucursal_id_idx" ON "recuento_inventario"("sucursal_id");

-- CreateIndex
CREATE INDEX "recuento_inventario_usuario_id_idx" ON "recuento_inventario"("usuario_id");

-- CreateIndex
CREATE INDEX "recuento_inventario_detalle_recuento_id_idx" ON "recuento_inventario_detalle"("recuento_id");

-- CreateIndex
CREATE INDEX "recuento_inventario_detalle_insumo_sucursal_id_idx" ON "recuento_inventario_detalle"("insumo_sucursal_id");

-- CreateIndex
CREATE INDEX "alerta_stock_insumo_sucursal_id_idx" ON "alerta_stock"("insumo_sucursal_id");

-- CreateIndex
CREATE INDEX "alerta_stock_insumo_sucursal_id_estado_idx" ON "alerta_stock"("insumo_sucursal_id", "estado");

-- CreateIndex
CREATE INDEX "venta_sucursal_id_idx" ON "venta"("sucursal_id");

-- CreateIndex
CREATE INDEX "venta_usuario_id_idx" ON "venta"("usuario_id");

-- CreateIndex
CREATE INDEX "venta_usuario_anulador_id_idx" ON "venta"("usuario_anulador_id");

-- CreateIndex
CREATE INDEX "venta_sucursal_id_created_at_idx" ON "venta"("sucursal_id", "created_at");

-- CreateIndex
CREATE INDEX "venta_detalle_venta_id_idx" ON "venta_detalle"("venta_id");

-- CreateIndex
CREATE INDEX "venta_detalle_producto_sucursal_variante_id_idx" ON "venta_detalle"("producto_sucursal_variante_id");

-- CreateIndex
CREATE INDEX "equipo_sucursal_id_idx" ON "equipo"("sucursal_id");

-- CreateIndex
CREATE INDEX "historial_equipo_equipo_id_idx" ON "historial_equipo"("equipo_id");

-- CreateIndex
CREATE INDEX "historial_equipo_usuario_id_idx" ON "historial_equipo"("usuario_id");

-- CreateIndex
CREATE INDEX "historial_equipo_equipo_id_created_at_idx" ON "historial_equipo"("equipo_id", "created_at");

-- AddForeignKey
ALTER TABLE "rol_permiso" ADD CONSTRAINT "rol_permiso_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_permiso" ADD CONSTRAINT "rol_permiso_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "permiso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_permiso" ADD CONSTRAINT "usuario_permiso_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_permiso" ADD CONSTRAINT "usuario_permiso_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "permiso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_permisos" ADD CONSTRAINT "historial_permisos_usuario_afectado_id_fkey" FOREIGN KEY ("usuario_afectado_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_permisos" ADD CONSTRAINT "historial_permisos_usuario_ejecutor_id_fkey" FOREIGN KEY ("usuario_ejecutor_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_permisos" ADD CONSTRAINT "historial_permisos_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "permiso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empleado" ADD CONSTRAINT "empleado_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empleado" ADD CONSTRAINT "empleado_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno" ADD CONSTRAINT "turno_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_turno" ADD CONSTRAINT "asignacion_turno_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_turno" ADD CONSTRAINT "asignacion_turno_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_asistencia" ADD CONSTRAINT "registro_asistencia_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_asistencia" ADD CONSTRAINT "registro_asistencia_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_asistencia" ADD CONSTRAINT "registro_asistencia_usuario_corrector_id_fkey" FOREIGN KEY ("usuario_corrector_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_asistencia" ADD CONSTRAINT "registro_asistencia_registro_original_id_fkey" FOREIGN KEY ("registro_original_id") REFERENCES "registro_asistencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto" ADD CONSTRAINT "producto_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria_producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_sucursal_variante" ADD CONSTRAINT "producto_sucursal_variante_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_sucursal_variante" ADD CONSTRAINT "producto_sucursal_variante_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_sucursal_variante" ADD CONSTRAINT "producto_sucursal_variante_variante_id_fkey" FOREIGN KEY ("variante_id") REFERENCES "variante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insumo_sucursal" ADD CONSTRAINT "insumo_sucursal_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insumo_sucursal" ADD CONSTRAINT "insumo_sucursal_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_insumo_sucursal_id_fkey" FOREIGN KEY ("insumo_sucursal_id") REFERENCES "insumo_sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recuento_inventario" ADD CONSTRAINT "recuento_inventario_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recuento_inventario" ADD CONSTRAINT "recuento_inventario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recuento_inventario_detalle" ADD CONSTRAINT "recuento_inventario_detalle_recuento_id_fkey" FOREIGN KEY ("recuento_id") REFERENCES "recuento_inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recuento_inventario_detalle" ADD CONSTRAINT "recuento_inventario_detalle_insumo_sucursal_id_fkey" FOREIGN KEY ("insumo_sucursal_id") REFERENCES "insumo_sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerta_stock" ADD CONSTRAINT "alerta_stock_insumo_sucursal_id_fkey" FOREIGN KEY ("insumo_sucursal_id") REFERENCES "insumo_sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_usuario_anulador_id_fkey" FOREIGN KEY ("usuario_anulador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_detalle" ADD CONSTRAINT "venta_detalle_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_detalle" ADD CONSTRAINT "venta_detalle_producto_sucursal_variante_id_fkey" FOREIGN KEY ("producto_sucursal_variante_id") REFERENCES "producto_sucursal_variante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipo" ADD CONSTRAINT "equipo_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_equipo" ADD CONSTRAINT "historial_equipo_equipo_id_fkey" FOREIGN KEY ("equipo_id") REFERENCES "equipo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_equipo" ADD CONSTRAINT "historial_equipo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
