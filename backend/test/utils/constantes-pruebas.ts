// Valores fijos de las pruebas end-to-end.
//
// El secreto JWT y las credenciales del administrador viven aqui, en el codigo,
// y NO en backend/.env. Es deliberado: las pruebas necesitan valores
// deterministas y reproducibles, y asi queda claro que no sirven fuera de la
// base de pruebas. Jamas se reutilizan en desarrollo ni produccion.
//
// La proteccion real no es que el valor sea publico, sino que la base de datos
// de las pruebas sea una distinta: `exigirBaseDePruebas` aborta si no termina
// en "_test".

/**
 * Secreto de firma de los tokens de las pruebas. 32+ caracteres porque es el
 * minimo que impone el esquema de variables de entorno, igual que en produccion.
 */
export const JWT_SECRET_PRUEBAS =
  'secreto-solo-para-pruebas-e2e-cafeteria-2026';

/** Correo del administrador que crea el seed en la base de pruebas. */
export const ADMIN_EMAIL_PRUEBAS = 'admin@cafeteria.test';

/**
 * Contrasena del administrador de pruebas.
 *
 * Cumple la politica real (12..72 bytes) para que el seed la acepte igual que
 * acepta la que alguien pone en desarrollo.
 */
export const ADMIN_PASSWORD_PRUEBAS = 'AdminPruebas2026!';

/**
 * Contrasena valida para los usuarios que crean las pruebas.
 * Tambien de 12..72 bytes.
 */
export const PASSWORD_VALIDA_PRUEBAS = 'PruebaValida2026!';

/** Contrasela que no cumple la politica: demasiado corta. */
export const PASSWORD_DEBIL_PRUEBAS = 'corta1';

// Nota sobre el coste de las pruebas: el hash de contrasena usa las 12 rondas
// reales de produccion (no se pueden bajar sin cambiar el codigo que se quiere
// probar), asi que cada usuario creado por HTTP cuesta ~250 ms. Por eso el
// numero de usuarios creados en las pruebas se mantiene bajo.