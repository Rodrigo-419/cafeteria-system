// Configuracion de variables de entorno validadas y tipadas.
import { z } from 'zod';

/**
 * Esquema de las variables de entorno que la aplicacion necesita.
 * Los valores por defecto se aplican aqui, no en el punto de uso, para que
 * exista una unica fuente de verdad validada.
 */
export const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Mensajes por variable. Se usan en lugar de los errores de zod porque
 * puede que estos ultimos incluyan el valor recibido, y los secretos
 * (DATABASE_URL) no deben aparecer en logs ni en la consola.
 */
const DESCRIPCIONES: Record<string, string> = {
  DATABASE_URL:
    'es obligatoria y debe ser una cadena de conexion no vacia (ej. postgresql://usuario:clave@localhost:5432/basedatos)',
  PORT: 'debe ser un numero entero mayor que 0 (por defecto 3000)',
  NODE_ENV: 'debe ser uno de: development, production, test (por defecto development)',
};

/**
 * Funcion de validacion para `ConfigModule.forRoot({ validate })`.
 * Falla en el arranque si falta o es invalida alguna variable obligatoria.
 */
export function validate(config: Record<string, unknown>): EnvConfig {
  const resultado = envSchema.safeParse(config);

  if (resultado.success) {
    return resultado.data;
  }

  const detalles = resultado.error.issues
    .map((issue) => {
      const variable = issue.path.length > 0 ? String(issue.path[0]) : '(desconocida)';
      return `  - ${variable}: ${DESCRIPCIONES[variable] ?? 'valor invalido'}`;
    })
    .join('\n');

  throw new Error(
    'Configuracion de entorno invalida: la aplicacion no puede arrancar.\n' +
      `${detalles}\n` +
      'Revisa backend/.env (plantilla en backend/.env.example).\n' +
      'Por seguridad no se muestran los valores recibidos.',
  );
}