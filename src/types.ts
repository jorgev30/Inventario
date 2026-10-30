import { Timestamp } from 'firebase/firestore';

export type ProductStatus = 'in_stock' | 'sold' | 'restock_ordered';

export interface Product {
  id: string;
  ownerId: string;
  name: string;
  sku: string;
  category: string;
  imageUrl: string;
  entryDate: string; // YYYY-MM-DD (Excel: Fecha)
  saleDate: string; // YYYY-MM-DD or "" (Excel: Fecha de Venta)
  unitCost: number; // Excel: Precio Unitario
  quantity: number; // Current available stock
  initialQuantity: number; // Excel: Cantidad del lote
  soldQuantity: number; // Units sold
  minStock: number; // Umbral de stock mínimo para alerta automática
  unitSalePrice: number; // Precio de venta por unidad
  totalSalePrice: number; // Excel: Precio de venta (total del lote)
  reinvestedAmount: number; // Excel: Dinero reeinvertido
  status: ProductStatus;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type MovementType = 'sale' | 'restock' | 'reinvestment' | 'adjustment';

export interface Movement {
  id: string;
  ownerId: string;
  productId: string;
  productName: string;
  type: MovementType;
  quantity: number;
  unitCost: number;
  unitSalePrice: number;
  totalAmount: number;
  profit: number;
  reinvestedAmount: number;
  date: string; // YYYY-MM-DD
  notes: string;
  createdAt?: Timestamp;
}

export interface ProductFormValues {
  name: string;
  sku: string;
  category: string;
  imageUrl: string;
  entryDate: string;
  saleDate: string;
  unitCost: number;
  quantity: number;
  initialQuantity: number;
  soldQuantity: number;
  minStock: number;
  unitSalePrice: number;
  totalSalePrice: number;
  reinvestedAmount: number;
  status: ProductStatus;
  notes: string;
}
