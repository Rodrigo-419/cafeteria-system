// Parche de resolucion para ejecutar la seed de demostracion.
//
// El cliente de Prisma generado en `src/generated/prisma` usa importaciones al
// estilo ESM con extension explicita (`./internal/class.js`) que apuntan a
// fuentes `.ts`. `tsx` (usado por `db:seed`) resuelve esa equivalencia solo,
// pero no emite la metadata de decoradores que Nest necesita para la inyeccion
// de dependencias, asi que la seed de demostracion se ejecuta con `ts-node`.
// `ts-node` en CommonJS no hace ese salto `.js` -> `.ts`, y este cargador se lo
// ensena: ante una peticion terminada en `.js` intenta primero el `.ts`
// equivalente y, si no existe, deja que Node resuelva como siempre.
const Module = require('node:module');

const resolverOriginal = Module._resolveFilename;

Module._resolveFilename = function (peticion, ...resto) {
  if (typeof peticion === 'string' && peticion.endsWith('.js')) {
    try {
      return resolverOriginal.call(
        this,
        peticion.slice(0, -'.js'.length) + '.ts',
        ...resto,
      );
    } catch {
      // Sin fuente .ts equivalente: se resuelve con la logica normal.
    }
  }

  return resolverOriginal.call(this, peticion, ...resto);
};
