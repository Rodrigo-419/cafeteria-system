import {
  MAXIMO_CANTIDAD,
  MAXIMO_LINEAS_VENTA,
  MINIMO_CANTIDAD,
  problemaDeMetodoPago,
  problemasLineas,
} from './lineas-venta';

const OFERTA_A = '01900000-0000-7000-8000-00000000000a';
const OFERTA_B = '01900000-0000-7000-8000-00000000000b';

describe('problemasLineas', () => {
  it('acepta unas lineas correctas', () => {
    expect(
      problemasLineas([
        { productoSucursalVarianteId: OFERTA_A, cantidad: 1 },
        { productoSucursalVarianteId: OFERTA_B, cantidad: MAXIMO_CANTIDAD },
      ]),
    ).toEqual([]);
  });

  it('exige al menos una linea', () => {
    expect(problemasLineas([])).toEqual([
      'La venta debe incluir al menos un producto',
    ]);
  });

  it('limita el numero de lineas', () => {
    const lineas = Array.from({ length: MAXIMO_LINEAS_VENTA + 1 }, (_v, i) => ({
      productoSucursalVarianteId: `id-${i}`,
      cantidad: 1,
    }));

    expect(problemasLineas(lineas)).toEqual([
      `Una venta no puede incluir mas de ${MAXIMO_LINEAS_VENTA} lineas`,
    ]);
  });

  it('rechaza cantidades que no sean enteras o se salgan del rango', () => {
    expect(
      problemasLineas([{ productoSucursalVarianteId: OFERTA_A, cantidad: 1.5 }]),
    ).toEqual(['La cantidad debe ser un numero entero']);

    expect(
      problemasLineas([{ productoSucursalVarianteId: OFERTA_A, cantidad: 0 }]),
    ).toEqual([
      `La cantidad debe estar entre ${MINIMO_CANTIDAD} y ${MAXIMO_CANTIDAD}`,
    ]);

    expect(
      problemasLineas([
        { productoSucursalVarianteId: OFERTA_A, cantidad: MAXIMO_CANTIDAD + 1 },
      ]),
    ).toEqual([
      `La cantidad debe estar entre ${MINIMO_CANTIDAD} y ${MAXIMO_CANTIDAD}`,
    ]);
  });

  it('rechaza repetir la misma oferta', () => {
    expect(
      problemasLineas([
        { productoSucursalVarianteId: OFERTA_A, cantidad: 1 },
        { productoSucursalVarianteId: OFERTA_A, cantidad: 2 },
      ]),
    ).toEqual(['Una misma oferta no puede repetirse en la venta']);
  });

  it('rechaza un id que no sea texto', () => {
    expect(
      problemasLineas([
        { productoSucursalVarianteId: 42 as unknown as string, cantidad: 1 },
      ]),
    ).toEqual(['Cada linea debe indicar una oferta valida']);
  });
});

describe('problemaDeMetodoPago', () => {
  it('acepta los metodos admitidos', () => {
    expect(problemaDeMetodoPago('efectivo')).toEqual([]);
    expect(problemaDeMetodoPago('tarjeta')).toEqual([]);
  });

  it('rechaza cualquier otra cosa', () => {
    expect(problemaDeMetodoPago('bizum')).toEqual([
      'El metodo de pago debe ser uno de: efectivo, tarjeta',
    ]);
    expect(problemaDeMetodoPago(undefined)).toHaveLength(1);
  });
});
