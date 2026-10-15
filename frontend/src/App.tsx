import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from '@/features/auth/LoginPage'
import { ProveedorAutenticacion } from '@/lib/auth/AuthContext'
import { RequirePermission } from '@/lib/permissions/RequirePermission'
import { AppLayout } from '@/components/layout/AppLayout'
import { Toaster } from '@/components/ui/sonner'
import { ComingSoonPage } from '@/features/system/ComingSoonPage'
import { DesignSystemPage } from '@/components/design/DesignSystemPage'
import { DashboardPage } from '@/routes/DashboardPage'
import { Forbidden } from '@/routes/Forbidden'
import { NotFound } from '@/routes/NotFound'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { MENU_ITEMS } from '@/lib/navigation/menu'
import { SalesHome } from '@/features/sales/SalesHome'
import { NewSalePage } from '@/features/sales/NewSalePage'
import { SaleDetailPage } from '@/features/sales/SaleDetailPage'
import { ProductsPage } from '@/features/products/ProductsPage'
import { InsumosPage } from '@/features/inventory/InsumosPage'
import { InventarioPage } from '@/features/inventory/InventarioPage'
import { AlertasPage } from '@/features/inventory/AlertasPage'
import { RecuentosPage } from '@/features/inventory/RecuentosPage'
import { RecuentoNuevoPage } from '@/features/inventory/RecuentoNuevoPage'
import { MovimientosPage } from '@/features/inventory/MovimientosPage'
import { EquiposPage } from '@/features/equipment/EquiposPage'
import { EquipoDetallePage } from '@/features/equipment/EquipoDetallePage'
import { UsuariosPage } from '@/features/users/UsuariosPage'
import { AuditoriaPage } from '@/features/audit/AuditoriaPage'

function crearQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  })
}

export function App({
  queryClient: clienteInyectado,
}: {
  queryClient?: QueryClient
} = {}) {
  const [clienteInterno] = useState(crearQueryClient)
  const queryClient = clienteInyectado ?? clienteInterno

  const rutasModulo = MENU_ITEMS.filter(
    (item) =>
      item.to !== '/' &&
      item.to !== '/sales' &&
      item.to !== '/products' &&
      item.to !== '/supplies' &&
      item.to !== '/inventory' &&
      item.to !== '/inventory/recuentos' &&
      item.to !== '/inventory/movimientos' &&
      item.to !== '/alerts' &&
      item.to !== '/equipment' &&
      item.to !== '/users' &&
      item.to !== '/auditoria',
  )

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ProveedorAutenticacion>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              {rutasModulo.map((item) => (
                <Route
                  key={item.to}
                  path={item.to.replace(/^\//, '')}
                  element={
                    <RequirePermission
                      permiso={item.permisos ?? []}
                      modo={item.modo ?? 'all'}
                    >
                      <ComingSoonPage />
                    </RequirePermission>
                  }
                />
              ))}
              <Route
                path="sales"
                element={
                  <RequirePermission
                    permiso={['ventas.ver', 'ventas.registrar']}
                    modo="any"
                  >
                    <SalesHome />
                  </RequirePermission>
                }
              />
              <Route
                path="sales/nueva"
                element={
                  <RequirePermission permiso="ventas.registrar">
                    <NewSalePage />
                  </RequirePermission>
                }
              />
              <Route
                path="sales/:id"
                element={
                  <RequirePermission permiso="ventas.ver">
                    <SaleDetailPage />
                  </RequirePermission>
                }
              />
              <Route
                path="products"
                element={
                  <RequirePermission
                    permiso={[
                      'productos.ver',
                      'productos.catalogo.editar',
                      'productos.precio.editar',
                    ]}
                    modo="any"
                  >
                    <ProductsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="supplies"
                element={
                  <RequirePermission
                    permiso={['insumos.ver', 'insumos.catalogo.editar']}
                    modo="any"
                  >
                    <InsumosPage />
                  </RequirePermission>
                }
              />
              <Route
                path="inventory"
                element={
                  <RequirePermission
                    permiso={[
                      'inventario.registrar',
                      'inventario.minimo.editar',
                      'inventario.recuento',
                      'insumos.ver',
                    ]}
                    modo="any"
                  >
                    <InventarioPage />
                  </RequirePermission>
                }
              />
              <Route
                path="alerts"
                element={
                  <RequirePermission permiso="alertas.ver_resolver">
                    <AlertasPage />
                  </RequirePermission>
                }
              />
              <Route
                path="inventory/recuentos"
                element={
                  <RequirePermission permiso="inventario.recuento">
                    <RecuentosPage />
                  </RequirePermission>
                }
              />
              <Route
                path="inventory/recuentos/nuevo"
                element={
                  <RequirePermission permiso="inventario.recuento">
                    <RecuentoNuevoPage />
                  </RequirePermission>
                }
              />
              <Route
                path="inventory/movimientos"
                element={
                  <RequirePermission permiso="inventario.registrar">
                    <MovimientosPage />
                  </RequirePermission>
                }
              />
              <Route
                path="equipment"
                element={
                  <RequirePermission
                    permiso={['equipo.ver', 'equipo.registrar_editar']}
                    modo="any"
                  >
                    <EquiposPage />
                  </RequirePermission>
                }
              />
              <Route
                path="equipment/:id"
                element={
                  <RequirePermission
                    permiso={['equipo.ver', 'equipo.registrar_editar']}
                    modo="any"
                  >
                    <EquipoDetallePage />
                  </RequirePermission>
                }
              />
              <Route
                path="users"
                element={
                  <RequirePermission
                    permiso={['usuarios.crear_editar', 'permisos.asignar']}
                    modo="any"
                  >
                    <UsuariosPage />
                  </RequirePermission>
                }
              />
              <Route
                path="auditoria"
                element={
                  <RequirePermission permiso="usuarios.crear_editar">
                    <AuditoriaPage />
                  </RequirePermission>
                }
              />
              {import.meta.env.DEV && (
                <Route path="design-system" element={<DesignSystemPage />} />
              )}
              <Route path="403" element={<Forbidden />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster />
        </ProveedorAutenticacion>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
