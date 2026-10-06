// Envoltorio de los listados paginados del modulo de inventario.
//
// Es la misma forma que usan `users` y `products` (`data`, `total`, `page`,
// `limit`, `totalPaginas`), a proposito: un cliente que ya sabe paginar un listado
// de productos no debería tener que aprender una segunda convención para el
// inventario, y un interceptor de paginado esperaría las mismas claves.

export type Paginado<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPaginas: number;
};

/**
 * Envuelve filas y total en el sobre de paginado.
 *
 * `totalPaginas` se calcula aquí y no en cada caso de uso para que el redondeo no
 * seDivida por cinco. Con `limit = 0` no hay páginas que repartir y sale 0, en
 * lugar de dividir entre cero.
 */
export function pagina<T>(
  filas: T[],
  total: number,
  page: number,
  limit: number,
): Paginado<T> {
  return {
    data: filas,
    total,
    page,
    limit,
    totalPaginas: limit > 0 ? Math.ceil(total / limit) : 0,
  };
}
