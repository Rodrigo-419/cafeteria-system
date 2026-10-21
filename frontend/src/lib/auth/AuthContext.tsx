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
import { toast } from 'sonner'
import {
  iniciarSesion as apiIniciarSesion,
  obtenerPerfil,
} from '@/lib/api/auth'
import {
  configurarManejadorNoAutorizado,
  configurarToken,
} from '@/lib/api/client'
import {
  MENSAJE_ARRANQUE_EN_FRIO,
  reintentarConArranqueEnFrio,
} from '@/lib/api/arranque-en-frio'
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
  /**
   * `true` mientras el login reintenta porque el servidor esta despertando.
   * En ese caso la interfaz muestra un aviso generico.
   */
  despertando: boolean
  motivoSalida: MotivoSalida
  iniciarSesion: (nombreUsuario: string, password: string) => Promise<void>
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
  const [despertando, setDespertando] = useState(false)

  const tokenRef = useRef<string | null>(inicial.sesion?.accessToken ?? null)

  useEffect(() => {
    tokenRef.current = sesion?.accessToken ?? null
  }, [sesion])

  // Bandera de montaje: evita actualizar el estado si el proveedor se desmonta
  // mientras una peticion asincrona estaba en vuelo (por ejemplo, al terminar
  // una prueba). En StrictMode el montaje vuelve a ponerla a `true`.
  const montadoRef = useRef(true)
  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
    }
  }, [])

  // El cliente HTTP lee el token vigente a traves de este proveedor.
  useEffect(() => configurarToken(() => tokenRef.current), [])

  const limpiarSesion = useCallback(
    (motivo: MotivoSalida) => {
      tokenRef.current = null
      eliminarSesion()
      setSesion(null)
      setMotivoSalida(motivo)
      // Al salir de la sesion no debe quedar ningun dato del usuario anterior:
      // se cancelan las peticiones en vuelo y se vacia por completo el cache.
      void queryClient.cancelQueries()
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
    // Al desmontar se aborta la peticion y se ignora cualquier respuesta
    // tardia: actualizar el estado de un componente ya desmontado (o de un
    // entorno de prueba ya destruido) provoca errores como
    // "window is not defined". La bandera se repone en la limpieza para que
    // StrictMode (montaje doble) vuelva a relanzar la peticion al remontar.
    const controlador = new AbortController()
    let cancelado = false
    let avisado = false
    reintentarConArranqueEnFrio(
      (signal) => obtenerPerfil(signal),
      {
        senalExterna: controlador.signal,
        alDetectar: () => {
          // Aviso generico una sola vez mientras el servidor despierta.
          if (!avisado) {
            avisado = true
            toast.info(MENSAJE_ARRANQUE_EN_FRIO)
          }
        },
      },
    )
      .then((usuario) => {
        if (cancelado) {
          return
        }
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
        // Nada que hacer: si fue un 401, el manejador ya limpio la sesion; si
        // el servidor seguia despertando, el aviso ya se mostro.
      })
      .finally(() => {
        if (!cancelado) {
          setCargando(false)
        }
      })
    return () => {
      cancelado = true
      controlador.abort()
      refreshHecho.current = false
    }
  }, [inicial.sesion])

  const iniciarSesion = useCallback(
    async (nombreUsuario: string, password: string) => {
      try {
        // Si el servidor esta despertando, se reintenta con un aviso generico.
        const respuesta = await reintentarConArranqueEnFrio(
          (signal) => apiIniciarSesion(nombreUsuario, password, signal),
          { alDetectar: () => setDespertando(true) },
        )
        // Si el proveedor se desmonto durante la peticion, no se actualiza estado.
        if (!montadoRef.current) {
          return
        }
        const nueva = crearSesion(
          respuesta.accessToken,
          respuesta.user,
          respuesta.expiresIn,
        )
        tokenRef.current = nueva.accessToken
        guardarSesion(nueva)
        // Defensa en profundidad: aunque el cierre de sesion ya limpio el cache,
        // se vuelve a vaciar antes de navegar para no arrastrar datos de la
        // cuenta anterior (por ejemplo, si la pestana se recargo sin login).
        void queryClient.cancelQueries()
        queryClient.clear()
        setMotivoSalida(null)
        setSesion(nueva)
      } finally {
        setDespertando(false)
      }
    },
    [queryClient],
  )

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
      despertando,
      motivoSalida,
      iniciarSesion,
      cerrarSesion,
      limpiarMotivoSalida,
    }),
    [
      sesion,
      cargando,
      despertando,
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
