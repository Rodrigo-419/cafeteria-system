import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation } from 'react-router-dom'
import { CoffeeIcon, EyeIcon, EyeOffIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
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
  const [mostrarContrasena, setMostrarContrasena] = useState(false)

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
    <div className="flex min-h-svh items-center justify-center bg-neutral-900 p-4">
      <Card className="relative w-full max-w-sm overflow-hidden pt-0">
        <div
          aria-hidden
          className="h-1.5 w-full bg-linear-to-r from-primary via-primary-400 to-secondary"
        />
        <CardHeader className="gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CoffeeIcon className="size-5" />
            </span>
            <div className="space-y-1">
              <Badge variant="secondary">Portal administrativo interno</Badge>
              <CardTitle className="text-xl">Iniciar sesión</CardTitle>
            </div>
          </div>
          <CardDescription>
            Accede al sistema de cafetería con tu usuario y contraseña.
          </CardDescription>
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
                    <div className="relative">
                      <FormControl>
                        <Input
                          type={mostrarContrasena ? 'text' : 'password'}
                          autoComplete="current-password"
                          className="pr-10"
                          {...field}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="absolute top-0.5 right-0.5"
                        aria-label={
                          mostrarContrasena
                            ? 'Ocultar contraseña'
                            : 'Mostrar contraseña'
                        }
                        onClick={() => setMostrarContrasena((valor) => !valor)}
                      >
                        {mostrarContrasena ? <EyeOffIcon /> : <EyeIcon />}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={enviando}>
                {enviando ? 'Ingresando…' : 'Ingresar'}
              </Button>
            </form>
          </Form>

          <p className="text-center text-xs text-muted-foreground">
            Acceso restringido al personal autorizado.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
