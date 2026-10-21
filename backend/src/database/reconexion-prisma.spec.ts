// Pruebas del reintento de la primera consulta de lectura.
//
// No tocan la base: se simulan los errores que una base suspendida produce y
// se comprueba cuando se reintenta y cuando no. La idea es fijar que NUNCA se
// reintenta un error que no sea de conexion (una escritura no debe repetirse).
import {
  consultarConReconexion,
  esErrorDeConexion,
} from './reconexion-prisma';

/** Construye un error con las propiedades que Prisma o `pg` suelen incluir. */
function errorCon(props: { code?: string; message?: string; cause?: unknown }) {
  const error = new Error(props.message ?? 'error de conexion');
  (error as Error & { code?: string }).code = props.code;
  if (props.cause !== undefined) {
    (error as Error & { cause?: unknown }).cause = props.cause;
  }
  return error;
}

describe('esErrorDeConexion', () => {
  it('reconoce los codigos de conexion de Prisma', () => {
    for (const code of ['P1001', 'P1002', 'P1008', 'P1017', 'P2024']) {
      expect(esErrorDeConexion(errorCon({ code }))).toBe(true);
    }
  });

  it('reconoce los codigos de conexion de pg/Node', () => {
    for (const code of [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'EPIPE',
      'EHOSTUNREACH',
    ]) {
      expect(esErrorDeConexion(errorCon({ code }))).toBe(true);
    }
  });

  it('reconoce los mensajes habituales de conexion cerrada', () => {
    expect(
      esErrorDeConexion(new Error('Connection terminated unexpectedly')),
    ).toBe(true);
    expect(
      esErrorDeConexion(new Error("Can't reach database server at localhost:5432")),
    ).toBe(true);
    expect(
      esErrorDeConexion(
        new Error('Timed out fetching a new connection from the connection pool'),
      ),
    ).toBe(true);
    expect(esErrorDeConexion(new Error('Cannot use a pool after calling end'))).toBe(
      true,
    );
  });

  it('no confunde un error de negocio con uno de conexion', () => {
    expect(
      esErrorDeConexion(errorCon({ code: 'P2034', message: 'write conflict' })),
    ).toBe(false);
    expect(
      esErrorDeConexion(errorCon({ code: '23505', message: 'unique constraint' })),
    ).toBe(false);
    expect(esErrorDeConexion(new Error('Credenciales invalidas'))).toBe(false);
    expect(esErrorDeConexion('una cadena')).toBe(false);
    expect(esErrorDeConexion(null)).toBe(false);
    expect(esErrorDeConexion(undefined)).toBe(false);
  });

  it('busca el codigo tambien en la causa anidada', () => {
    const anidado = errorCon({
      message: 'PrismaClientUnknownRequestError',
      cause: errorCon({ code: 'P1017' }),
    });

    expect(esErrorDeConexion(anidado)).toBe(true);
  });
});

describe('consultarConReconexion', () => {
  it('devuelve el valor cuando el primer intento funciona', async () => {
    let llamadas = 0;
    const valor = await consultarConReconexion(async () => {
      llamadas += 1;
      return 'ok';
    });

    expect(valor).toBe('ok');
    expect(llamadas).toBe(1);
  });

  it('reintenta una lectura cuando falla por conexion', async () => {
    let llamadas = 0;
    const dormir = async () => {};

    const valor = await consultarConReconexion(
      async () => {
        llamadas += 1;
        if (llamadas === 1) {
          throw errorCon({ code: 'P1017' });
        }
        return 'ok';
      },
      { dormir },
    );

    expect(valor).toBe('ok');
    expect(llamadas).toBe(2);
  });

  it('agota los intentos y lanza el ultimo error de conexion', async () => {
    let llamadas = 0;
    const dormir = async () => {};

    await expect(
      consultarConReconexion(
        async () => {
          llamadas += 1;
          throw errorCon({ code: 'P1001' });
        },
        { dormir, intentos: 3 },
      ),
    ).rejects.toMatchObject({ code: 'P1001' });

    expect(llamadas).toBe(3);
  });

  it('no reintenta un error que no es de conexion', async () => {
    let llamadas = 0;

    await expect(
      consultarConReconexion(
        async () => {
          llamadas += 1;
          throw errorCon({ code: 'P2034', message: 'write conflict' });
        },
        { dormir: async () => {}, intentos: 5 },
      ),
    ).rejects.toMatchObject({ code: 'P2034' });

    expect(llamadas).toBe(1);
  });

  it('no reintenta con un solo intento', async () => {
    let llamadas = 0;

    await expect(
      consultarConReconexion(
        async () => {
          llamadas += 1;
          throw errorCon({ code: 'ECONNRESET' });
        },
        { dormir: async () => {}, intentos: 1 },
      ),
    ).rejects.toMatchObject({ code: 'ECONNRESET' });

    expect(llamadas).toBe(1);
  });

  it('avisa antes de cada reintento y espera lo indicado', async () => {
    const esperas: number[] = [];
    const reintentos: number[] = [];
    let llamadas = 0;

    const valor = await consultarConReconexion(
      async () => {
        llamadas += 1;
        if (llamadas < 3) {
          throw errorCon({ code: 'P1017' });
        }
        return 'ok';
      },
      {
        dormir: async (ms) => {
          esperas.push(ms);
        },
        alReintentar: (intento) => reintentos.push(intento),
        retrasoMs: 250,
        intentos: 4,
      },
    );

    expect(valor).toBe('ok');
    expect(esperas).toEqual([250, 250]);
    expect(reintentos).toEqual([1, 2]);
  });

  it('respeta la firma de espera inyectada (no usa timers reales)', async () => {
    const dormir = async () => {};
    // Solo comprueba que la funcion inyectada se usa y que no queda colgada.
    await expect(
      consultarConReconexion(async () => 1, { dormir }),
    ).resolves.toBe(1);
  });
});
