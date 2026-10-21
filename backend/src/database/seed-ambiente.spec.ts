// Pruebas unitarias de las reglas puras que protegen el destino del seed.
//
// No tocan la base ni la red: solo comprueban como se resuelve el host, como se
// pide la confirmacion y que una `DATABASE_URL` del entorno gana a la del
// archivo `.env` (comportamiento que garantiza que lanzar el seed contra Neon
// desde la consola no pueda escribir en la base del `.env`).
import { config as cargarDotenv } from 'dotenv';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  analizarDestinoBase,
  ARGUMENTOS_CONFIRMACION,
  confirmarDestino,
  describirDestino,
  esConfirmacionExplicita,
  esHostLocal,
  leerConfirmacion,
  mensajeConfirmacion,
  VARIABLE_CONFIRMACION,
} from './seed-ambiente';

describe('seed: proteccion del destino', () => {
  describe('esHostLocal', () => {
    it('reconoce los hosts locales habituales', () => {
      expect(esHostLocal('localhost')).toBe(true);
      expect(esHostLocal('127.0.0.1')).toBe(true);
      expect(esHostLocal('::1')).toBe(true);
      expect(esHostLocal('')).toBe(true);
    });

    it('rechaza un host remoto', () => {
      expect(esHostLocal('ep-cool-name-123456.us-east-2.aws.neon.tech')).toBe(
        false,
      );
      expect(esHostLocal('db.produccion.es')).toBe(false);
    });

    it('ignora mayusculas y espacios', () => {
      expect(esHostLocal('  LOCALHOST  ')).toBe(true);
    });
  });

  describe('analizarDestinoBase', () => {
    it('extrae host y base de una URL local', () => {
      const destino = analizarDestinoBase(
        'postgresql://cafeteria:clave@localhost:5432/cafeteria_db?schema=public',
      );

      expect(destino.host).toBe('localhost');
      expect(destino.nombreBase).toBe('cafeteria_db');
      expect(destino.esLocal).toBe(true);
    });

    it('extrae host y base de una URL remota', () => {
      const destino = analizarDestinoBase(
        'postgresql://usuario:clave@ep-cool-name-123456.us-east-2.aws.neon.tech:5432/cafeteria_db?sslmode=require',
      );

      expect(destino.host).toBe('ep-cool-name-123456.us-east-2.aws.neon.tech');
      expect(destino.nombreBase).toBe('cafeteria_db');
      expect(destino.esLocal).toBe(false);
    });

    it('trata el formato de socket unix como local', () => {
      const destino = analizarDestinoBase(
        'postgresql:///cafeteria_db?host=/var/run/postgresql',
      );

      expect(destino.host).toBe('');
      expect(destino.nombreBase).toBe('cafeteria_db');
      expect(destino.esLocal).toBe(true);
    });

    it('lanza un mensaje claro con una URL invalida', () => {
      expect(() => analizarDestinoBase('no-es-una-url')).toThrow(
        /DATABASE_URL/i,
      );
    });

    it('nunca expone el usuario ni la clave en el resultado', () => {
      const destino = analizarDestinoBase(
        'postgresql://usuario:supersecreto@remoto.example.com:5432/db',
      );

      expect(JSON.stringify(destino)).not.toContain('supersecreto');
      expect(JSON.stringify(destino)).not.toContain('usuario');
    });
  });

  describe('describirDestino', () => {
    it('incluye el host y la base', () => {
      const texto = describirDestino({
        host: 'remoto.example.com',
        nombreBase: 'cafeteria_db',
        esLocal: false,
      });

      expect(texto).toContain('remoto.example.com');
      expect(texto).toContain('cafeteria_db');
    });

    it('describe el socket unix sin mostrar un host vacio', () => {
      expect(describirDestino({ host: '', nombreBase: 'db', esLocal: true })).toMatch(
        /socket unix local/i,
      );
    });
  });

  describe('esConfirmacionExplicita', () => {
    it('acepta los valores afirmativos habituales', () => {
      expect(esConfirmacionExplicita('1')).toBe(true);
      expect(esConfirmacionExplicita('true')).toBe(true);
      expect(esConfirmacionExplicita('si')).toBe(true);
      expect(esConfirmacionExplicita('YES')).toBe(true);
    });

    it('rechaza un valor ausente, vacio o negativo', () => {
      expect(esConfirmacionExplicita(undefined)).toBe(false);
      expect(esConfirmacionExplicita('')).toBe(false);
      expect(esConfirmacionExplicita('0')).toBe(false);
      expect(esConfirmacionExplicita('no')).toBe(false);
    });
  });

  describe('leerConfirmacion', () => {
    it('acepta un argumento de confirmacion', () => {
      expect(leerConfirmacion(['node', 'seed.ts', '--confirm'], {})).toBe(true);
      expect(leerConfirmacion(['node', 'seed.ts', '-y'], {})).toBe(true);
      expect(ARGUMENTOS_CONFIRMACION.length).toBeGreaterThan(0);
    });

    it('acepta la variable de entorno', () => {
      expect(
        leerConfirmacion([], { [VARIABLE_CONFIRMACION]: '1' }),
      ).toBe(true);
    });

    it('no confirma sin argumento ni variable', () => {
      expect(leerConfirmacion(['node', 'seed.ts'], {})).toBe(false);
      expect(leerConfirmacion([], {})).toBe(false);
    });
  });

  describe('confirmarDestino', () => {
    const remoto = {
      host: 'remoto.example.com',
      nombreBase: 'cafeteria_db',
      esLocal: false,
    };
    const local = {
      host: 'localhost',
      nombreBase: 'cafeteria_db',
      esLocal: true,
    };

    it('permite un destino local sin confirmacion', () => {
      expect(() => confirmarDestino(local, false)).not.toThrow();
    });

    it('rechaza un destino remoto sin confirmacion', () => {
      expect(() => confirmarDestino(remoto, false)).toThrow(
        /base REMOTA/i,
      );
    });

    it('el mensaje de rechazo incluye host y base', () => {
      try {
        confirmarDestino(remoto, false);
        throw new Error('Se esperaba un rechazo');
      } catch (error) {
        const mensaje = (error as Error).message;
        expect(mensaje).toContain('remoto.example.com');
        expect(mensaje).toContain('cafeteria_db');
        expect(mensaje).toContain(ARGUMENTOS_CONFIRMACION[0]);
        expect(mensaje).toContain(VARIABLE_CONFIRMACION);
      }
    });

    it('permite un destino remoto con confirmacion explicita', () => {
      expect(() => confirmarDestino(remoto, true)).not.toThrow();
    });

    it('el mensaje de rechazo no revela el usuario ni la clave', () => {
      try {
        confirmarDestino(remoto, false);
        throw new Error('Se esperaba un rechazo');
      } catch (error) {
        expect((error as Error).message).not.toContain('usuario');
        expect((error as Error).message).not.toContain('clave');
      }
    });
  });

  describe('mensajeConfirmacion', () => {
    it('incluye el destino y como confirmar', () => {
      const mensaje = mensajeConfirmacion({
        host: 'remoto.example.com',
        nombreBase: 'produccion',
        esLocal: false,
      });

      expect(mensaje).toContain('remoto.example.com');
      expect(mensaje).toContain('produccion');
      expect(mensaje).toContain(ARGUMENTOS_CONFIRMACION[0]);
    });
  });

  describe('prioridad de la DATABASE_URL del entorno', () => {
    it('dotenv no pisa una DATABASE_URL ya presente en el entorno', () => {
      const directorio = mkdtempSync(join(tmpdir(), 'seed-env-'));
      const archivo = join(directorio, '.env');
      writeFileSync(
        archivo,
        'DATABASE_URL=postgresql://usuario:clave@localhost:5432/desde_archivo\n',
      );

      const original = process.env.DATABASE_URL;
      process.env.DATABASE_URL =
        'postgresql://usuario:clave@localhost:5432/desde_entorno';

      try {
        cargarDotenv({ path: archivo });
        expect(process.env.DATABASE_URL).toContain('desde_entorno');
      } finally {
        if (original === undefined) {
          delete process.env.DATABASE_URL;
        } else {
          process.env.DATABASE_URL = original;
        }
        rmSync(directorio, { recursive: true, force: true });
      }
    });
  });
});
