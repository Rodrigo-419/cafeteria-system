// Esquema de validacion del formulario de login.
//
// Es una de las dos unicas respuestas que se parsean con Zod en el frontend
// (la otra es `/auth/me`): lo critico se valida, el resto de la API se tipa con
// TypeScript sin duplicar los DTO.
import { z } from 'zod'

export const esquemaLogin = z.object({
  nombreUsuario: z
    .string()
    .min(1, { message: 'El usuario es obligatorio' })
    .max(30, { message: 'El usuario no puede exceder 30 caracteres' }),
  password: z
    .string()
    .min(1, { message: 'La contraseña es obligatoria' })
    .max(128, { message: 'La contraseña no puede exceder 128 caracteres' }),
})

export type ValoresLogin = z.infer<typeof esquemaLogin>
