// Diccionario de etiquetas en español para la exportación.

// El backend devuelve claves crudas (enums) y la exportación las convierte en
// texto legible.

export const ETIQUETA_ESTADO_USUARIO: Record<string, string> = {
  activo: 'Activo',
  bloqueado: 'Bloqueado',
}

export const ETIQUETA_ESTADO_EMPLEADO: Record<string, string> = {
  activo: 'Activo',
  inactivo: 'Cesado',
}

export const ETIQUETA_TIPO_TURNO: Record<string, string> = {
  fijo: 'Fijo',
  variable: 'Variable',
}

export const ETIQUETA_TIPO_MARCAJE: Record<string, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
}

export const ETIQUETA_MOVIMIENTO: Record<string, string> = {
  entrada: 'Entrada',
  ajuste: 'Ajuste',
}

export const ETIQUETA_METODO_PAGO: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
}

export const ETIQUETA_ESTADO_VENTA: Record<string, string> = {
  completada: 'Completada',
  anulada: 'Anulada',
}

export const ETIQUETA_ESTADO_EQUIPO: Record<string, string> = {
  funcionando: 'Funcionando',
  danado: 'Dañado',
  en_mantenimiento: 'En mantenimiento',
  retirado: 'Retirado',
}

export const ETIQUETA_PRESENTACION_INSUMO: Record<string, string> = {
  paquete: 'Paquete',
  bolsa: 'Bolsa',
  caja: 'Caja',
  unidad: 'Unidad',
  paquete_varias_unidades: 'Paquete (varias unidades)',
}

export const ETIQUETA_ESTADO_STOCK: Record<string, string> = {
  activo: 'Activo',
  descontinuado: 'Descontinuado',
}

export const ETIQUETA_OFERTA: Record<string, string> = {
  activo: 'Activo',
  inactivo: 'Inactivo',
}

export const ETIQUETA_ESTADO_ALERTA: Record<string, string> = {
  abierta: 'Abierta',
  resuelta: 'Resuelta',
}

export const ETIQUETA_ESTADO_ASIGNACION: Record<string, string> = {
  activa: 'Activa',
  finalizada: 'Finalizada',
}

export const ETIQUETA_ROL: Record<string, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  empleado: 'Empleado',
}

export const ETIQUETA_ENTIDAD_AUDITORIA: Record<string, string> = {
  usuario: 'Usuario',
  empleado: 'Empleado',
  turno: 'Turno',
  asignacion: 'Asignación',
  equipo: 'Equipo',
  venta: 'Venta',
  producto: 'Producto',
  variante: 'Variante',
  insumo: 'Insumo',
  sucursal: 'Sucursal',
  alerta: 'Alerta',
  movimiento_inventario: 'Movimiento de inventario',
  cierre_caja: 'Cierre de caja',
  asistencia: 'Asistencia',
  falta: 'Falta',
  categoria: 'Categoría',
  exportacion: 'Exportación',
}

export const ETIQUETA_ACCION_AUDITORIA: Record<string, string> = {
  login_exitoso: 'Inicio de sesión exitoso',
  login_fallido: 'Inicio de sesión fallido',
  usuario_creado: 'Usuario creado',
  usuario_editado: 'Usuario editado',
  usuario_estado_cambiado: 'Estado de usuario cambiado',
  password_cambiado: 'Contraseña cambiada',
  empleado_creado: 'Empleado creado',
  empleado_editado: 'Empleado editado',
  empleado_estado_cambiado: 'Estado de empleado cambiado',
  turno_creado: 'Turno creado',
  turno_editado: 'Turno editado',
  turno_eliminado: 'Turno eliminado',
  asignacion_creada: 'Asignación creada',
  asignacion_retirada: 'Asignación retirada',
  equipo_creado: 'Equipo creado',
  equipo_editado: 'Equipo editado',
  equipo_estado_cambiado: 'Estado de equipo cambiado',
  venta_creada: 'Venta creada',
  venta_anulada: 'Venta anulada',
  producto_creado: 'Producto creado',
  producto_editado: 'Producto editado',
  variante_creada: 'Variante creada',
  variante_editada: 'Variante editada',
  insumo_creado: 'Insumo creado',
  insumo_editado: 'Insumo editado',
  sucursal_creada: 'Sucursal creada',
  sucursal_editada: 'Sucursal editada',
  alerta_creada: 'Alerta creada',
  alerta_resuelta: 'Alerta resuelta',
  movimiento_inventario_creado: 'Movimiento de inventario creado',
  cierre_caja_iniciado: 'Cierre de caja iniciado',
  cierre_caja_cerrado: 'Cierre de caja cerrado',
  asistencia_registrada: 'Asistencia registrada',
  asistencia_corregida: 'Asistencia corregida',
  falta_registrada: 'Falta registrada',
  falta_justificada: 'Falta justificada',
  categoria_creada: 'Categoría creada',
  categoria_editada: 'Categoría editada',
  exportacion_generada: 'Exportación generada',
  exportacion_fallida: 'Exportación fallida',
}

export const ETIQUETAS_CONJUNTOS: Record<string, string> = {
  ventas: 'Ventas',
  carta: 'Carta',
  stock: 'Stock',
  movimientos: 'Movimientos',
  empleados: 'Empleados',
  turnos: 'Turnos',
  asignaciones: 'Asignaciones',
  asistencia: 'Asistencia',
  faltas: 'Faltas',
  equipos: 'Equipos',
  usuarios: 'Usuarios',
  sucursales: 'Sucursales',
  reporte: 'Reporte comparativo',
  auditoria: 'Auditoría',
};

export function getEtiquetaConjunto(conjunto: string): string {
  return ETIQUETAS_CONJUNTOS[conjunto] ?? conjunto;
}

/** Etiqueta de una clave; si no existe, devuelve la clave sin adorno. */
export function etiquetaDe(mapa: Record<string, string>, clave: string): string {
  return mapa[clave] ?? clave
}

// ------------------------------------------------------ completitud enums
export const VALORES_ENUM: Record<string, readonly string[]> = {
  UsuarioEstado: ['activo', 'bloqueado'],
  EmpleadoEstado: ['activo', 'inactivo'],
  TurnoTipo: ['fijo', 'variable'],
  RegistroAsistenciaTipo: ['entrada', 'salida'],
  MovimientoInventarioTipo: ['entrada', 'ajuste'],
  VentaMetodoPago: ['efectivo', 'tarjeta'],
  VentaEstado: ['completada', 'anulada'],
  EquipoEstado: ['funcionando', 'danado', 'en_mantenimiento', 'retirado'],
  InsumoPresentacion: [
    'paquete',
    'bolsa',
    'caja',
    'unidad',
    'paquete_varias_unidades',
  ],
  InsumoSucursalEstado: ['activo', 'descontinuado'],
  ProductoSucursalVarianteEstado: ['activo', 'inactivo'],
  AlertaStockEstado: ['abierta', 'resuelta'],
  AuditoriaEntidad: Object.keys(ETIQUETA_ENTIDAD_AUDITORIA),
  AuditoriaAccion: Object.keys(ETIQUETA_ACCION_AUDITORIA),
}
