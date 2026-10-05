import {
  calcularPermisosEfectivos,
  PermisoIndividual,
} from './calcular-permisos-efectivos';

describe('calcularPermisosEfectivos', () => {
  it('devuelve los permisos del rol cuando no hay permisos individuales', () => {
    expect(calcularPermisosEfectivos(['ventas.ver', 'ventas.crear'], [])).toEqual([
      'ventas.crear',
      'ventas.ver',
    ]);
  });

  it('devuelve un arreglo vacio cuando no hay ningun permiso', () => {
    expect(calcularPermisosEfectivos([], [])).toEqual([]);
  });

  it('suma los concedidos individualmente', () => {
    const individuales: PermisoIndividual[] = [
      { codigo: 'reportes.ver', tipo: 'concedido' },
    ];

    expect(calcularPermisosEfectivos(['ventas.ver'], individuales)).toEqual([
      'reportes.ver',
      'ventas.ver',
    ]);
  });

  it('resta los revocados individualmente', () => {
    const individuales: PermisoIndividual[] = [
      { codigo: 'ventas.crear', tipo: 'revocado' },
    ];

    expect(calcularPermisosEfectivos(['ventas.crear', 'ventas.ver'], individuales)).toEqual([
      'ventas.ver',
    ]);
  });

  it('la revocacion gana aunque el permiso venga del rol', () => {
    const individuales: PermisoIndividual[] = [
      { codigo: 'ventas.ver', tipo: 'concedido' },
      { codigo: 'ventas.ver', tipo: 'revocado' },
    ];

    expect(calcularPermisosEfectivos(['ventas.ver'], individuales)).toEqual([]);
  });

  it('elimina duplicados entre rol, concedidos y revocados', () => {
    const individuales: PermisoIndividual[] = [
      { codigo: 'ventas.ver', tipo: 'concedido' },
      { codigo: 'ventas.ver', tipo: 'concedido' },
      { codigo: 'ventas.ver', tipo: 'concedido' },
    ];

    expect(calcularPermisosEfectivos(['ventas.ver', 'ventas.ver'], individuales)).toEqual([
      'ventas.ver',
    ]);
  });

  it('aplica concedidos y revocados en el orden en que llegan', () => {
    const individuales: PermisoIndividual[] = [
      { codigo: 'a', tipo: 'revocado' },
      { codigo: 'a', tipo: 'concedido' },
    ];

    expect(calcularPermisosEfectivos([], individuales)).toEqual(['a']);
  });

  it('devuelve un arreglo ordenado para que la respuesta sea estable', () => {
    const resultado = calcularPermisosEfectivos(['zeta', 'alfa', 'medio'], []);

    expect(resultado).toEqual(['alfa', 'medio', 'zeta']);
  });

  it('un permiso revocado que el usuario nunca tuvo no genera errores', () => {
    const individuales: PermisoIndividual[] = [
      { codigo: 'nunca.tenido', tipo: 'revocado' },
    ];

    expect(calcularPermisosEfectivos(['ventas.ver'], individuales)).toEqual(['ventas.ver']);
  });

  it('un permiso revocado y luego concedido vuelve a estar activo', () => {
    const individuales: PermisoIndividual[] = [
      { codigo: 'ventas.ver', tipo: 'revocado' },
      { codigo: 'ventas.ver', tipo: 'concedido' },
    ];

    expect(calcularPermisosEfectivos(['ventas.ver'], individuales)).toEqual(['ventas.ver']);
  });
});