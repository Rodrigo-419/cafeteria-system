import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation } from 'react-router-dom'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api/errors'
import { useAuth } from '@/lib/auth/useAuth'
import { esquemaLogin, type ValoresLogin } from './login.schema'

function mensajeDeError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 401:
        return 'Usuario o contraseña incorrectos.'
      case 403:
        return 'Tu cuenta está bloqueada. Contacta al administrador.'
      case 429:
        return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.'
      default:
        return error.mensajes.join(' ')
    }
  }
  return 'No se pudo conectar con el servidor. Inténtalo de nuevo.'
}

export function LoginPage() {
  const { autenticado, iniciarSesion, motivoSalida, limpiarMotivoSalida } =
    useAuth()
  const location = useLocation()
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)

  const form = useForm<ValoresLogin>({
    resolver: zodResolver(esquemaLogin),
    defaultValues: { nombreUsuario: '', password: '' },
  })

  const enviando = form.formState.isSubmitting
  const destino = (location.state as { from?: string } | null)?.from ?? '/'

  if (autenticado) {
    return <Navigate to={destino} replace />
  }

  const onSubmit = form.handleSubmit(async (valores) => {
    setErrorEnvio(null)
    limpiarMotivoSalida()
    try {
      await iniciarSesion(valores.nombreUsuario, valores.password)
    } catch (error) {
      setErrorEnvio(mensajeDeError(error))
    }
  })

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Iniciar sesión</CardTitle>
          <CardDescription>Sistema de cafetería</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {motivoSalida === 'expirada' && (
            <Alert variant="destructive">
              <AlertTitle>Sesión expirada</AlertTitle>
              <AlertDescription>
                Tu sesión venció. Inicia sesión de nuevo.
              </AlertDescription>
            </Alert>
          )}

          {errorEnvio !== null && (
            <Alert variant="destructive">
              <AlertTitle>No se pudo iniciar sesión</AlertTitle>
              <AlertDescription>{errorEnvio}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={onSubmit} className="grid gap-4" noValidate>
              <FormField
                control={form.control}
                name="nombreUsuario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usuario</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        autoComplete="username"
                        placeholder="admin"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={enviando}>
                {enviando ? 'Ingresando…' : 'Ingresar'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
