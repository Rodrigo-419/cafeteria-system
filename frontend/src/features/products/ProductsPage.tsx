// Pantalla de productos y precios.
//
// El backend separa dos ámbitos que aquí se muestran como subpáginas del grupo
// "Productos": el catálogo global (productos, categorías y variantes,
// administrado por el Admin) y la carta de cada sucursal (precios y estado,
// gestionada por el Gerente). La subnavegación de la cabecera enlaza a
// `/products` y `/products?vista=carta`; la ruta base no cambia.
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/shared/PageHeader'
import { CartaSeccion } from './CartaSeccion'
import { CatalogoSeccion } from './CatalogoSeccion'

export function ProductsPage() {
  const [parametros] = useSearchParams()
  const vista = parametros.get('vista') === 'carta' ? 'carta' : 'catalogo'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Productos y precios"
        description="Catálogo global y carta de precios por sucursal"
      />
      {vista === 'carta' ? <CartaSeccion /> : <CatalogoSeccion />}
    </div>
  )
}
