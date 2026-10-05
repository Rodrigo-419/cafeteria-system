import { Module } from '@nestjs/common';
import { CategoriasService } from './categorias.service';
import { OfertasService } from './ofertas.service';
import { ProductosService } from './productos.service';
import { ProductsRepository } from './products.repository';
import { VariantesService } from './variantes.service';
import { BranchProductsController } from './branch-products.controller';
import { ProductCategoriesController } from './product-categories.controller';
import { ProductsController } from './products.controller';
import { VariantsController } from './variants.controller';

@Module({
  controllers: [
    ProductCategoriesController,
    VariantsController,
    ProductsController,
    BranchProductsController,
  ],
  providers: [
    ProductsRepository,
    CategoriasService,
    VariantesService,
    ProductosService,
    OfertasService,
  ],
  exports: [ProductsRepository],
})
export class ProductsModule {}
