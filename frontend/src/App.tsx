import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from '@/features/auth/LoginPage'
import { ProveedorAutenticacion } from '@/lib/auth/AuthContext'
import { RequirePermission } from '@/lib/permissions/RequirePermission'
import { AppLayout } from '@/components/layout/AppLayout'
import { ComingSoonPage } from '@/features/system/ComingSoonPage'
import { DesignSystemPage } from '@/components/design/DesignSystemPage'
import { DashboardPage } from '@/routes/DashboardPage'
import { Forbidden } from '@/routes/Forbidden'
import { NotFound } from '@/routes/NotFound'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { MENU_ITEMS } from '@/lib/navigation/menu'

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

export function App() {
  const [queryClient] = useState(crearQueryClient)

  const rutasModulo = MENU_ITEMS.filter((item) => item.to !== '/')

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
              {import.meta.env.DEV && (
                <Route path="design-system" element={<DesignSystemPage />} />
              )}
              <Route path="403" element={<Forbidden />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ProveedorAutenticacion>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
