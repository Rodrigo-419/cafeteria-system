// Envoltorio de los listados paginados del modulo de ventas.
//
// Es la misma forma que usan `users`, `products` e `inventory` (`data`,
// `total`, `page`, `limit`, `totalPaginas`), a proposito: un cliente que ya
// sabe paginar un listado de productos no deberia tener que aprender una segunda
// convencion para las ventas.

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
 * `totalPaginas` se calcula aqui y no en cada caso de uso para que el
 * redondeo no se divida por cinco. Con `limit = 0` no hay paginas que repartir
 * y sale 0, en lugar de dividir entre cero.
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
