// Contrato de validacion de los DTO de ventas.
//
// No se repiten aqui las reglas del dominio (eso ya lo hacen las specs de
// `domain/rules`); lo que si se comprueba es lo que la capa de presentacion
// anade por su cuenta y que las pruebas unitarias de las reglas no ven:
//
//   * `@Transform` recibe los parametros de la transformacion, no el valor.
//     Un error ahi no rompe ni `tsc` ni el lint: el campo simplemente deja de
//     recortarse y, peor, deja de validar, y todo llega hasta la base.
//   * Los errores de validacion salen como `message: string[]`, no como
//     `string`. El E2E los compara asi, y cambiar el formato romperia la API.

// `reflect-metadata` instala `Reflect.getMetadata`, sin el cual los decoradores
// de class-validator y class-transformer no pueden leer sus propiedades. En
// produccion lo trae `@nestjs/core`; un spec que solo importa el DTO no pasa
// por ahi, asi que lo carga aqui.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import {
  AnularVentaDto,
  ListarVentasDto,
  RegistrarVentaDto,
} from './sales.dto';

/**
 * Mensajes que la API devuelve para un fallo, con la misma composicion de
 * ruta que hace `ValidationPipe` de Nest: el prefijo lleva las propiedades
 * PADRE (`items.0.`) y no la del propio fallo (`cantidad`).
 */
function mensajesDeFallo(fallo: ValidationError, rutaPadre?: string): string[] {
  if (!fallo.children || fallo.children.length === 0) {
    const mensajes = Object.values(fallo.constraints ?? {});
    return rutaPadre === undefined
      ? mensajes
      : mensajes.map((mensaje) => `${rutaPadre}.${mensaje}`);
  }

  const ruta = rutaPadre === undefined ? fallo.property : `${rutaPadre}.${fallo.property}`;
  return fallo.children.flatMap((hijo) => mensajesDeFallo(hijo, ruta));
}

async function problemas(cuerpo: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(RegistrarVentaDto, cuerpo);
  const fallos = await validate(dto, { whitelist: true });

  // Orden alfabeticos: el orden en que class-validator devuelve los fallos
  // depende del orden de las propiedades, que no es parte del contrato.
  return fallos.flatMap((fallo) => mensajesDeFallo(fallo)).sort();
}

describe('AnularVentaDto', () => {
  it('recorta el motivo antes de validarlo', async () => {
    const dto = plainToInstance(AnularVentaDto, { motivo: '  Se equivoco  ' });

    expect(dto.motivo).toBe('Se equivoco');
    expect(await validate(dto)).toEqual([]);
  });

  it('exige un motivo con contenido', async () => {
    const fallos = await validate(plainToInstance(AnularVentaDto, { motivo: '   ' }));

    expect(fallos).toHaveLength(1);
    expect(Object.values(fallos[0].constraints ?? {})).toEqual([
      'El motivo de la anulacion no puede estar vacio',
    ]);
  });

  it('el motivo ausente o demasiado largo no pasa', async () => {
    const ausente = await validate(plainToInstance(AnularVentaDto, {}));
    expect(Object.values(ausente[0].constraints ?? {})).toContain(
      'El motivo debe ser texto',
    );

    const largo = await validate(
      plainToInstance(AnularVentaDto, { motivo: 'x'.repeat(201) }),
    );
    expect(Object.values(largo[0].constraints ?? {})).toEqual([
      'El motivo no puede exceder 200 caracteres',
    ]);
  });
});

describe('RegistrarVentaDto', () => {
  it('acepta una venta bien formada', async () => {
    const dto = plainToInstance(RegistrarVentaDto, {
      metodoPago: 'efectivo',
      items: [{ productoSucursalVarianteId: '11111111-1111-4111-8111-111111111111', cantidad: 2 }],
    });

    expect(await validate(dto)).toEqual([]);
  });

  it('describe cada problema de las lineas con su propiedad', async () => {
    expect(await problemas({ metodoPago: 'bizum', items: [] })).toEqual([
      'El metodo de pago debe ser uno de: efectivo, tarjeta',
      'La venta debe incluir al menos un producto',
    ]);

    expect(
      await problemas({
        metodoPago: 'efectivo',
        items: [{ productoSucursalVarianteId: 'no-es-uuid', cantidad: 0 }],
      }),
    ).toEqual([
      'items.0.Cada linea debe indicar una oferta valida',
      'items.0.La cantidad minima es 1',
    ]);
  });
});

describe('ListarVentasDto', () => {
  it('convierte page y limit del query en numeros', async () => {
    const dto = plainToInstance(ListarVentasDto, { page: '3', limit: '10' });

    expect(dto.page).toBe(3);
    expect(dto.limit).toBe(10);
    expect(await validate(dto)).toEqual([]);
  });

  it('acepta un dia local real y rechaza uno que no existe', async () => {
    const valida = plainToInstance(ListarVentasDto, { fecha: '2026-10-06' });
    expect(await validate(valida)).toEqual([]);

    const imposible = await validate(plainToInstance(ListarVentasDto, { fecha: '2026-02-30' }));
    expect(Object.values(imposible[0].constraints ?? {})).toEqual([
      'La fecha debe ser un dia valido en formato YYYY-MM-DD',
    ]);
  });

  it('rechaza un limit mayor que 100 y una sucursal que no es uuid', async () => {
    const limit = await validate(plainToInstance(ListarVentasDto, { limit: '101' }));
    expect(Object.values(limit[0].constraints ?? {})).toEqual([
      'limit no puede exceder 100',
    ]);

    const sucursal = await validate(
      plainToInstance(ListarVentasDto, { sucursalId: 'no-es-uuid' }),
    );
    expect(Object.values(sucursal[0].constraints ?? {})).toEqual([
      'El filtro sucursalId debe ser un identificador valido',
    ]);
  });
});
