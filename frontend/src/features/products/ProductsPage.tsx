// Pantalla de productos y precios.
//
// El backend separa dos ámbitos que aquí se muestran en pestañas: el catálogo
// global (productos, categorías y variantes, administrado por el Admin) y la
// carta de cada sucursal (precios y estado, gestionada por el Gerente).
import { PageHeader } from '@/components/shared/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CartaSeccion } from './CartaSeccion'
import { CatalogoSeccion } from './CatalogoSeccion'

export function ProductsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Productos y precios"
        description="Catálogo global y carta de precios por sucursal"
      />
      <Tabs defaultValue="catalogo" className="space-y-4">
        <TabsList>
          <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
          <TabsTrigger value="carta">Carta por sucursal</TabsTrigger>
        </TabsList>
        <TabsContent value="catalogo">
          <CatalogoSeccion />
        </TabsContent>
        <TabsContent value="carta">
          <CartaSeccion />
        </TabsContent>
      </Tabs>
    </div>
  )
}
