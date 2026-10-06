import { catalogService } from '../src/services/catalog-service.js';

async function findProducts() {
  const products = await catalogService.getProducts();
  console.log('Total productos:', products.length);
  const service4Products = products.filter((p: any) => p.serviceId === 4);
  console.log('Productos para serviceId 4 (Cooperación en TIC):');
  console.log(JSON.stringify(service4Products, null, 2));

  const allProducts = products.map((p: any) => ({ id: p.id, serviceId: p.serviceId, name: p.name }));
  console.log('Todos los productos:', JSON.stringify(allProducts, null, 2));
}

findProducts().catch(console.error);
