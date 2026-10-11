// Proveedor de autenticacion: mantiene la sesion en memoria, la respalda en
// `sessionStorage`, refresca los permisos con `GET /auth/me` al arrancar y
// reacciona ante un 401 en cualquier peticion autenticada.
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  iniciarSesion as apiIniciarSesion,
  obtenerPerfil,
} from '@/lib/api/auth'
import {
  configurarManejadorNoAutorizado,
  configurarToken,
} from '@/lib/api/client'
import type { UsuarioApi } from '@/types/api'
import {
  cargarSesionInicial,
  crearSesion,
  eliminarSesion,
  guardarSesion,
  type Sesion,
} from './session'

/** Motivo por el que se salio de la sesion; se usa para avisar en el login. */
export type MotivoSalida = 'expirada' | null

export interface ValorAutenticacion {
  usuario: UsuarioApi | null
  permisos: readonly string[]
  autenticado: boolean
  /** `true` mientras se valida la sesion guardada al arrancar. */
  cargando: boolean
  motivoSalida: MotivoSalida
  iniciarSesion: (email: string, password: string) => Promise<void>
  cerrarSesion: () => void
  limpiarMotivoSalida: () => void
}

export const ContextoAutenticacion = createContext<ValorAutenticacion | null>(
  null,
)

export function ProveedorAutenticacion({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  // `cargarSesionInicial` se evalua una sola vez (inicializador perezoso de
  // `useState`) para no leer el almacenamiento en cada render.
  const [inicial] = useState(cargarSesionInicial)

  const [sesion, setSesion] = useState<Sesion | null>(inicial.sesion)
  const [motivoSalida, setMotivoSalida] = useState<MotivoSalida>(
    inicial.expirada ? 'expirada' : null,
  )
  const [cargando, setCargando] = useState(inicial.sesion !== null)

  const tokenRef = useRef<string | null>(inicial.sesion?.accessToken ?? null)

  useEffect(() => {
    tokenRef.current = sesion?.accessToken ?? null
  }, [sesion])

  // El cliente HTTP lee el token vigente a traves de este proveedor.
  useEffect(() => configurarToken(() => tokenRef.current), [])

  const limpiarSesion = useCallback(
    (motivo: MotivoSalida) => {
      tokenRef.current = null
      eliminarSesion()
      setSesion(null)
      setMotivoSalida(motivo)
      queryClient.clear()
    },
    [queryClient],
  )

  // Un 401 en una peticion autenticada limpia la sesion y deja el aviso listo.
  useEffect(() => {
    configurarManejadorNoAutorizado(() => limpiarSesion('expirada'))
    return () => configurarManejadorNoAutorizado(null)
  }, [limpiarSesion])

  // Al arrancar, si hay sesion guardada, se refrescan los permisos efectivos.
  // Un 401 aqui lo captura el manejador de arriba y limpia la sesion.
  const refreshHecho = useRef(false)
  useEffect(() => {
    if (refreshHecho.current) {
      return
    }
    refreshHecho.current = true
    if (!inicial.sesion) {
      return
    }
    obtenerPerfil()
      .then((usuario) => {
        setSesion((actual) => {
          if (!actual) {
            return actual
          }
          const actualizada: Sesion = { ...actual, user: usuario }
          guardarSesion(actualizada)
          tokenRef.current = actualizada.accessToken
          return actualizada
        })
      })
      .catch(() => {
        // Nada que hacer: si fue un 401, el manejador ya limpio la sesion.
      })
      .finally(() => setCargando(false))
  }, [inicial.sesion])

  const iniciarSesion = useCallback(async (email: string, password: string) => {
    const respuesta = await apiIniciarSesion(email, password)
    const nueva = crearSesion(
      respuesta.accessToken,
      respuesta.user,
      respuesta.expiresIn,
    )
    tokenRef.current = nueva.accessToken
    guardarSesion(nueva)
    setMotivoSalida(null)
    setSesion(nueva)
  }, [])

  const cerrarSesion = useCallback(() => {
    limpiarSesion(null)
  }, [limpiarSesion])

  const limpiarMotivoSalida = useCallback(() => setMotivoSalida(null), [])

  const valor = useMemo<ValorAutenticacion>(
    () => ({
      usuario: sesion?.user ?? null,
      permisos: sesion?.user.permisos ?? [],
      autenticado: sesion !== null,
      cargando,
      motivoSalida,
      iniciarSesion,
      cerrarSesion,
      limpiarMotivoSalida,
    }),
    [
      sesion,
      cargando,
      motivoSalida,
      iniciarSesion,
      cerrarSesion,
      limpiarMotivoSalida,
    ],
  )

  return (
    <ContextoAutenticacion.Provider value={valor}>
      {children}
    </ContextoAutenticacion.Provider>
  )
}
