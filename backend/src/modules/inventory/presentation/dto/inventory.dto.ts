// DTOs de la API de inventario.
//
// Las cantidades viajan como numero con dos decimales. No se usa
// `@IsNumber({ maxDecimalPlaces: 2 })` porque esa opcion mide los decimales con
// `valor.toString().split('.')[1].length`, y para un numero en notacion
// exponencial ese elemento es `undefined`: `{"cantidad": 1e-7}` revienta con un
// TypeError (500) en vez de responder 400. En su lugar, `IsCantidadValida`
// delega en la regla pura, que ya trata ese caso sin lanzar.
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import {
  problemasCantidad,
  tipoProblemasCantidad,
  type OpcionesCantidad,
} from '../../domain/rules/cantidades';
import {
  NOMBRE_INSUMO_MAXIMO,
  NOMBRE_INSUMO_MINIMO,
} from '../../domain/rules/nombres';
import { PRESENTACIONES_INSUMO } from '../../domain/rules/presentacion-insumo';

/** Estados de la fila `insumo_sucursal`. */
export const ESTADOS_STOCK = ['activo', 'descontinuado'] as const;
export type EstadoStock = (typeof ESTADOS_STOCK)[number];

/** Estados de alerta. */
export const ESTADOS_ALERTA_DTO = ['abierta', 'resuelta'] as const;
export type EstadoAlertaDto = (typeof ESTADOS_ALERTA_DTO)[number];

/** Tipos de movimiento. */
export const TIPOS_MOVIMIENTO = ['entrada', 'ajuste'] as const;
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

/**
 * Recorta un texto de entrada y convierte una cadena de espacios en `undefined`,
 * para que un filtro en blanco no acabe contando como criterio de busqueda.
 */
function recortar(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const limpio = value.trim();

  return limpio === '' ? undefined : limpio;
}

/**
 * Valida una cantidad con la regla pura de `cantidades`.
 *
 * @param opciones que se admiten: `noNegativa` (el minimo, el stock fisico
 * contado) o `positiva` (la cantidad de una entrada o de un ajuste).
 */
export function IsCantidadValida(
  opciones: OpcionesCantidad,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'cantidadValida',
      target: object.constructor,
      propertyName,
      constraints: [],
      options: validationOptions,
      validator: {
        validate: (valor: unknown) => problemasCantidad(valor, opciones).length === 0,
        defaultMessage: (args: ValidationArguments) =>
          problemasCantidad(args.value, opciones).join('. '),
      },
    });
  };
}

/** Convierte un parametro de query (siempre texto) en numero. */
function numero() {
  return Type(() => Number);
}

// ------------------------------------------------------------------ catálogo

export class CrearInsumoDto {
  @IsString({ message: 'El nombre es obligatorio' })
  @MinLength(NOMBRE_INSUMO_MINIMO, {
    message: `El nombre debe tener al menos ${NOMBRE_INSUMO_MINIMO} caracteres`,
  })
  @MaxLength(NOMBRE_INSUMO_MAXIMO, {
    message: `El nombre no puede exceder ${NOMBRE_INSUMO_MAXIMO} caracteres`,
  })
  nombre: string;

  @IsIn(PRESENTACIONES_INSUMO, {
    message: `La presentacion debe ser una de: ${PRESENTACIONES_INSUMO.join(', ')}`,
  })
  presentacion: (typeof PRESENTACIONES_INSUMO)[number];
}

export class EditarInsumoDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser texto' })
  @MinLength(NOMBRE_INSUMO_MINIMO, {
    message: `El nombre debe tener al menos ${NOMBRE_INSUMO_MINIMO} caracteres`,
  })
  @MaxLength(NOMBRE_INSUMO_MAXIMO, {
    message: `El nombre no puede exceder ${NOMBRE_INSUMO_MAXIMO} caracteres`,
  })
  nombre?: string;

  @IsOptional()
  @IsIn(PRESENTACIONES_INSUMO, {
    message: `La presentacion debe ser una de: ${PRESENTACIONES_INSUMO.join(', ')}`,
  })
  presentacion?: (typeof PRESENTACIONES_INSUMO)[number];
}

export class ListarInsumosDto {
  @IsOptional()
  @numero()
  @IsInt({ message: 'page debe ser un entero' })
  @Min(1, { message: 'page debe ser mayor o igual a 1' })
  page?: number;

  @IsOptional()
  @numero()
  @IsInt({ message: 'limit debe ser un entero' })
  @Min(1, { message: 'limit debe ser mayor o igual a 1' })
  @Max(100, { message: 'limit no puede exceder 100' })
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => recortar(value))
  @IsString()
  @MaxLength(NOMBRE_INSUMO_MAXIMO, {
    message: `La busqueda no puede exceder ${NOMBRE_INSUMO_MAXIMO} caracteres`,
  })
  q?: string;

  @IsOptional()
  @IsIn(PRESENTACIONES_INSUMO, {
    message: `El filtro presentacion debe ser una de: ${PRESENTACIONES_INSUMO.join(', ')}`,
  })
  presentacion?: (typeof PRESENTACIONES_INSUMO)[number];
}

// --------------------------------------------------------------------- stock

export class ListarStockDto {
  @IsOptional()
  @numero()
  @IsInt({ message: 'page debe ser un entero' })
  @Min(1, { message: 'page debe ser mayor o igual a 1' })
  page?: number;

  @IsOptional()
  @numero()
  @IsInt({ message: 'limit debe ser un entero' })
  @Min(1, { message: 'limit debe ser mayor o igual a 1' })
  @Max(100, { message: 'limit no puede exceder 100' })
  limit?: number;

  @IsOptional()
  @IsIn(ESTADOS_STOCK, {
    message: `El filtro estado debe ser uno de: ${ESTADOS_STOCK.join(', ')}`,
  })
  estado?: EstadoStock;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean({ message: 'soloBajoMinimo debe ser un booleano' })
  soloBajoMinimo?: boolean;

  @IsOptional()
  @Transform(({ value }) => recortar(value))
  @IsString()
  @MaxLength(NOMBRE_INSUMO_MAXIMO, {
    message: `La busqueda no puede exceder ${NOMBRE_INSUMO_MAXIMO} caracteres`,
  })
  q?: string;
}

export class ConfigurarStockDto {
  // El minimo admite cero: "no hay minimo" es una configuracion valida.
  @IsOptional()
  @IsCantidadValida(tipoProblemasCantidad.noNegativa)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'El stock minimo debe ser un numero' },
  )
  stockMinimo?: number;

  @IsOptional()
  @IsIn(ESTADOS_STOCK, {
    message: `El estado debe ser uno de: ${ESTADOS_STOCK.join(', ')}`,
  })
  estado?: EstadoStock;
}

export class RegistrarEntradaDto {
  // Una entrada de cero unidades no es una entrada.
  @IsCantidadValida(tipoProblemasCantidad.positiva)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'La cantidad debe ser un numero' },
  )
  cantidad: number;

  @IsOptional()
  @IsString({ message: 'El motivo debe ser texto' })
  @MinLength(1, { message: 'El motivo no puede estar vacio' })
  @MaxLength(200, { message: 'El motivo no puede exceder 200 caracteres' })
  motivo?: string;
}

export class ListarMovimientosDto {
  @IsOptional()
  @numero()
  @IsInt({ message: 'page debe ser un entero' })
  @Min(1, { message: 'page debe ser mayor o igual a 1' })
  page?: number;

  @IsOptional()
  @numero()
  @IsInt({ message: 'limit debe ser un entero' })
  @Min(1, { message: 'limit debe ser mayor o igual a 1' })
  @Max(100, { message: 'limit no puede exceder 100' })
  limit?: number;

  @IsOptional()
  @IsUUID('all', { message: 'El filtro insumoId debe ser un identificador valido' })
  insumoId?: string;

  @IsOptional()
  @IsIn(TIPOS_MOVIMIENTO, {
    message: `El filtro tipo debe ser uno de: ${TIPOS_MOVIMIENTO.join(', ')}`,
  })
  tipo?: TipoMovimiento;

  @IsOptional()
  @Type(() => Date)
  desde?: Date;

  @IsOptional()
  @Type(() => Date)
  hasta?: Date;
}

// ------------------------------------------------------------------ recuentos

export class LineaRecuentoDto {
  @IsUUID('all', { message: 'Cada linea debe indicar un insumo valido' })
  insumoId: string;

  // El fisico admite cero: "no queda ninguno" es un resultado legitimo.
  @IsCantidadValida(tipoProblemasCantidad.noNegativa)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'El stock fisico debe ser un numero' },
  )
  stockFisico: number;
}

export class CrearRecuentoDto {
  @IsArray({ message: 'items debe ser una lista' })
  @ArrayMinSize(1, { message: 'El recuento debe incluir al menos un insumo' })
  @ArrayMaxSize(500, { message: 'Un recuento no puede incluir mas de 500 insumos' })
  @ValidateNested({ each: true })
  @Type(() => LineaRecuentoDto)
  items: LineaRecuentoDto[];
}

export class ListarRecuentosDto {
  @IsOptional()
  @numero()
  @IsInt({ message: 'page debe ser un entero' })
  @Min(1, { message: 'page debe ser mayor o igual a 1' })
  page?: number;

  @IsOptional()
  @numero()
  @IsInt({ message: 'limit debe ser un entero' })
  @Min(1, { message: 'limit debe ser mayor o igual a 1' })
  @Max(100, { message: 'limit no puede exceder 100' })
  limit?: number;

  @IsOptional()
  @IsUUID('all', { message: 'El filtro sucursalId debe ser un identificador valido' })
  sucursalId?: string;
}

// -------------------------------------------------------------------- alertas

export class ListarAlertasDto {
  @IsOptional()
  @numero()
  @IsInt({ message: 'page debe ser un entero' })
  @Min(1, { message: 'page debe ser mayor o igual a 1' })
  page?: number;

  @IsOptional()
  @numero()
  @IsInt({ message: 'limit debe ser un entero' })
  @Min(1, { message: 'limit debe ser mayor o igual a 1' })
  @Max(100, { message: 'limit no puede exceder 100' })
  limit?: number;

  @IsOptional()
  @IsUUID('all', { message: 'El filtro sucursalId debe ser un identificador valido' })
  sucursalId?: string;

  @IsOptional()
  @IsIn(ESTADOS_ALERTA_DTO, {
    message: `El filtro estado debe ser uno de: ${ESTADOS_ALERTA_DTO.join(', ')}`,
  })
  estado?: EstadoAlertaDto;
}
