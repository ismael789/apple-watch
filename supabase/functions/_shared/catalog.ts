export type Product = {
  amount: number;
  currency: 'mxn';
  description: string;
};

export const PRODUCTS: Readonly<Record<string, Product>> = Object.freeze({
  school_material: {
    amount: 1000,
    currency: 'mxn',
    description: 'Material escolar de prueba',
  },
  watch_accessory: {
    amount: 1299,
    currency: 'mxn',
    description: 'Accesorio educativo de prueba',
  },
});

export const getProduct = (productId: unknown): Product | null =>
  typeof productId === 'string' &&
  Object.prototype.hasOwnProperty.call(PRODUCTS, productId)
    ? PRODUCTS[productId]
    : null;

