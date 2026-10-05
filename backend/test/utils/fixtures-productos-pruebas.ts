// Datos de partida para las pruebas de productos.
//
// Los ids se leen de la base porque el seed genera UUIDs v7 nuevas en cada reset:
// un id fijo en el codigo dejaria de ser valido en cuanto cambiara el seed.
import { clientePrueba } from './reset-database';
import { NOMBRE_VARIANTE_BASE } from '../../src/modules/products/products.rules';

export type Variantes = {
  unica: string;
  chico: string;
  mediano: string;
  grande: string;
};

/** Ids de las cuatro variantes que crea el seed, por nombre. */
export async function idsDeVariantes(): Promise<Variantes> {
  const filas = await clientePrueba().variante.findMany({
    select: { id: true, nombre: true },
  });

  const porNombre = new Map(filas.map((f) => [f.nombre, f.id]));
  const obtener = (nombre: string): string => {
    const id = porNombre.get(nombre);
    if (!id) {
      throw new Error(`El seed no creo la variante "${nombre}"`);
    }
    return id;
  };

  return {
    unica: obtener(NOMBRE_VARIANTE_BASE),
    chico: obtener('Chico'),
    mediano: obtener('Mediano'),
    grande: obtener('Grande'),
  };
}
