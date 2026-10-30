import { Product, Movement, ProductFormValues } from '../types';

export function formatCOP(value: number): string {
  const safeVal = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeVal);
}

export function formatCOPCompact(value: number): string {
  const safeVal = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safeVal);
}

export function formatExcelDate(isoDate: string): string {
  if (!isoDate) return '—';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const shortYear = String(year).slice(-2);
  return `${String(day).padStart(2, '0')}-${months[month] || 'mes'}-${shortYear}`;
}

export function isProductSold(product: Product): boolean {
  return (
    product.status === 'sold' ||
    product.quantity === 0 ||
    Boolean(product.saleDate && product.saleDate.trim().length >= 8)
  );
}

export interface InventoryTimeInfo {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isLive: boolean;
  isPreSale: boolean;
  headline: string;
  sublabel: string;
  agingTier: 'fast' | 'medium' | 'slow' | 'sold';
}

export function calculateInventoryTime(
  entryDate: string,
  saleDate: string,
  quantity: number,
  now: Date,
  status?: string
): InventoryTimeInfo {
  const entryParts = entryDate.split('-').map(Number);
  const entryTime =
    entryParts.length === 3
      ? new Date(entryParts[0], entryParts[1] - 1, entryParts[2], 0, 0, 0).getTime()
      : now.getTime();

  // If sold or has a valid saleDate
  if (
    saleDate &&
    saleDate.trim().length >= 10 &&
    (quantity === 0 || status === 'sold')
  ) {
    const saleParts = saleDate.split('-').map(Number);
    const saleTime =
      saleParts.length === 3
        ? new Date(saleParts[0], saleParts[1] - 1, saleParts[2], 12, 0, 0).getTime()
        : now.getTime();
    const diffMs = saleTime - entryTime;
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isLive: false,
        isPreSale: true,
        headline: `0 días (Preventa ${Math.abs(diffDays)}d antes)`,
        sublabel: `Vendido ${formatExcelDate(saleDate)} · Ingreso ${formatExcelDate(entryDate)}`,
        agingTier: 'sold',
      };
    }

    return {
      days: diffDays,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isLive: false,
      isPreSale: false,
      headline: `${diffDays} ${diffDays === 1 ? 'día' : 'días'} (Vendido)`,
      sublabel: `Vendido el ${formatExcelDate(saleDate)}`,
      agingTier: 'sold',
    };
  }

  // Otherwise calculate real-time elapsed time in inventory right now
  const elapsedMs = Math.max(0, now.getTime() - entryTime);
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let agingTier: 'fast' | 'medium' | 'slow' = 'fast';
  if (days > 30) {
    agingTier = 'slow';
  } else if (days >= 15) {
    agingTier = 'medium';
  }

  return {
    days,
    hours,
    minutes,
    seconds,
    isLive: true,
    isPreSale: false,
    headline: `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`,
    sublabel:
      agingTier === 'slow'
        ? 'Rotación lenta (>30 días en stock)'
        : agingTier === 'medium'
        ? 'Rotación media (15–30 días)'
        : 'Rotación saludable (<15 días)',
    agingTier,
  };
}

export interface ProductMetrics {
  totalBatchCost: number; // Excel Col E: Total (Precio Unitario * Cantidad Inicial)
  currentStockCost: number; // Valor actual en bodega (Precio Unitario * Cantidad Disponible)
  totalSalePrice: number; // Excel Col F: Precio de venta
  totalProfit: number; // Excel Col G: Utilidad (Precio de venta - Total)
  unitProfit: number; // Utilidad por unidad
  roiPercent: number; // % Rentabilidad sobre costo
  marginPercent: number; // % Margen sobre venta
  realizedRevenue: number; // Ingresos ya cobrados por unidades vendidas
  realizedProfit: number; // Ganancia ya realizada
  alertLevel: 'out_of_stock' | 'low_stock' | 'optimal';
  alertLabel: string;
  suggestedReorderQty: number;
  estimatedReorderCost: number;
}

export function calculateProductMetrics(product: Product): ProductMetrics {
  const initialQty = Math.max(1, product.initialQuantity || product.quantity || 1);
  const totalBatchCost = product.unitCost * initialQty;
  const currentStockCost = product.unitCost * product.quantity;
  const totalSalePrice =
    product.totalSalePrice > 0 ? product.totalSalePrice : product.unitSalePrice * initialQty;
  const totalProfit = totalSalePrice - totalBatchCost;
  const unitProfit = product.unitSalePrice - product.unitCost;
  const roiPercent = totalBatchCost > 0 ? (totalProfit / totalBatchCost) * 100 : 0;
  const marginPercent = totalSalePrice > 0 ? (totalProfit / totalSalePrice) * 100 : 0;

  const sold = isProductSold(product);
  const soldUnits = Math.max(
    0,
    product.soldQuantity > 0 ? product.soldQuantity : sold ? initialQty : 0
  );
  const realizedRevenue = soldUnits * product.unitSalePrice;
  const realizedProfit = soldUnits * unitProfit;

  let alertLevel: 'out_of_stock' | 'low_stock' | 'optimal' = 'optimal';
  let alertLabel = 'Stock Óptimo';

  if (product.quantity <= 0 || product.status === 'sold') {
    alertLevel = 'out_of_stock';
    alertLabel = 'Agotado · Reabastecer Urgente';
  } else if (product.quantity <= product.minStock) {
    alertLevel = 'low_stock';
    alertLabel = `Stock Mínimo Alcanzado (${product.quantity}/${product.minStock})`;
  }

  const targetStock = Math.max(product.minStock * 2, product.minStock + 2, 3);
  const suggestedReorderQty =
    alertLevel === 'optimal' ? 0 : Math.max(1, targetStock - product.quantity);
  const estimatedReorderCost = suggestedReorderQty * product.unitCost;

  return {
    totalBatchCost,
    currentStockCost,
    totalSalePrice,
    totalProfit,
    unitProfit,
    roiPercent,
    marginPercent,
    realizedRevenue,
    realizedProfit,
    alertLevel,
    alertLabel,
    suggestedReorderQty,
    estimatedReorderCost,
  };
}

export interface MonthlySummaryRow {
  monthKey: string; // YYYY-MM
  monthLabel: string; // e.g. "Septiembre 2026"
  productsAddedCount: number;
  unitsPurchased: number;
  unitsSold: number;
  totalInvestedCost: number;
  projectedBatchRevenue: number;
  projectedBatchProfit: number;
  realizedSalesRevenue: number;
  realizedNetProfit: number;
  reinvestedCapital: number;
  freeCashFlow: number;
  avgDaysInInventory: number;
  roiPercent: number;
}

const MONTH_NAMES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export function formatMonthKey(monthKey: string): string {
  const parts = monthKey.split('-');
  if (parts.length !== 2) return monthKey;
  const year = parts[0];
  const monthIndex = parseInt(parts[1], 10) - 1;
  return `${MONTH_NAMES_ES[monthIndex] || parts[1]} ${year}`;
}

export function buildMonthlyReports(
  products: Product[],
  movements: Movement[],
  now: Date
): MonthlySummaryRow[] {
  const map = new Map<string, MonthlySummaryRow>();

  const ensureMonth = (monthKey: string): MonthlySummaryRow => {
    if (!map.has(monthKey)) {
      map.set(monthKey, {
        monthKey,
        monthLabel: formatMonthKey(monthKey),
        productsAddedCount: 0,
        unitsPurchased: 0,
        unitsSold: 0,
        totalInvestedCost: 0,
        projectedBatchRevenue: 0,
        projectedBatchProfit: 0,
        realizedSalesRevenue: 0,
        realizedNetProfit: 0,
        reinvestedCapital: 0,
        freeCashFlow: 0,
        avgDaysInInventory: 0,
        roiPercent: 0,
      });
    }
    return map.get(monthKey)!;
  };

  const daysPerMonth = new Map<string, number[]>();

  products.forEach((p) => {
    const entryMonth = (p.entryDate || '2026-09-10').slice(0, 7);
    const row = ensureMonth(entryMonth);
    const metrics = calculateProductMetrics(p);
    const timeInfo = calculateInventoryTime(
      p.entryDate,
      p.saleDate,
      p.quantity,
      now,
      p.status
    );

    row.productsAddedCount += 1;
    row.unitsPurchased += p.initialQuantity;
    row.totalInvestedCost += metrics.totalBatchCost;
    row.projectedBatchRevenue += metrics.totalSalePrice;
    row.projectedBatchProfit += metrics.totalProfit;
    row.reinvestedCapital += p.reinvestedAmount || 0;

    if (!daysPerMonth.has(entryMonth)) {
      daysPerMonth.set(entryMonth, []);
    }
    daysPerMonth.get(entryMonth)!.push(timeInfo.days);

    if (isProductSold(p) || p.soldQuantity > 0) {
      const saleMonth =
        p.saleDate && p.saleDate.length >= 7 ? p.saleDate.slice(0, 7) : entryMonth;
      const saleRow = ensureMonth(saleMonth);
      const soldQty = p.soldQuantity > 0 ? p.soldQuantity : p.initialQuantity;
      saleRow.unitsSold += soldQty;
      saleRow.realizedSalesRevenue += soldQty * p.unitSalePrice;
      saleRow.realizedNetProfit += soldQty * (p.unitSalePrice - p.unitCost);
    }
  });

  movements.forEach((m) => {
    const mMonth = (m.date || '2026-10-19').slice(0, 7);
    ensureMonth(mMonth);
  });

  const rows = Array.from(map.values()).map((r) => {
    const dList = daysPerMonth.get(r.monthKey) || [];
    const avgDays =
      dList.length > 0
        ? Math.round(dList.reduce((acc, v) => acc + v, 0) / dList.length)
        : 0;
    const roiPercent =
      r.totalInvestedCost > 0
        ? (r.projectedBatchProfit / r.totalInvestedCost) * 100
        : 0;
    const freeCashFlow = r.realizedSalesRevenue - r.reinvestedCapital;

    return {
      ...r,
      avgDaysInInventory: avgDays,
      roiPercent,
      freeCashFlow,
    };
  });

  return rows.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}

// Defensive Payload Constraints matching firebase-blueprint.json & firestore.rules
export function sanitizeProductPayload(form: ProductFormValues, ownerId: string) {
  const cleanUnitCost = Math.max(0, Number(form.unitCost) || 0);
  const cleanInitialQty = Math.max(1, Math.round(Number(form.initialQuantity) || 1));
  const hasSaleDate = Boolean(form.saleDate && form.saleDate.trim().length >= 8);
  const isMarkedSold = form.status === 'sold' || hasSaleDate || Number(form.quantity) === 0;

  const cleanQty = isMarkedSold
    ? 0
    : Math.max(0, Math.round(Number(form.quantity) || 0));
  const cleanSoldQty = isMarkedSold
    ? Math.max(1, Math.round(Number(form.soldQuantity) || cleanInitialQty))
    : Math.max(0, Math.round(Number(form.soldQuantity) || 0));

  const cleanMinStock = Math.max(0, Math.round(Number(form.minStock) || 0));
  const cleanUnitSale = Math.max(0, Number(form.unitSalePrice) || 0);
  const cleanTotalSale =
    Number(form.totalSalePrice) > 0
      ? Math.max(0, Number(form.totalSalePrice))
      : cleanUnitSale * cleanInitialQty;
  const cleanReinvested = Math.max(0, Number(form.reinvestedAmount) || 0);
  const todayStr = new Date().toISOString().slice(0, 10);

  return {
    ownerId: ownerId.slice(0, 128),
    name: (form.name || 'Producto sin nombre').trim().slice(0, 150),
    sku: (form.sku || 'SKU-001').trim().slice(0, 50),
    category: (form.category || 'General').trim().slice(0, 80),
    imageUrl: (form.imageUrl || '').trim().slice(0, 145000),
    entryDate: (form.entryDate || todayStr).trim().slice(0, 30),
    saleDate: isMarkedSold
      ? (form.saleDate || todayStr).trim().slice(0, 30)
      : '',
    unitCost: cleanUnitCost,
    quantity: cleanQty,
    initialQuantity: cleanInitialQty,
    soldQuantity: cleanSoldQty,
    minStock: cleanMinStock,
    unitSalePrice: cleanUnitSale,
    totalSalePrice: cleanTotalSale,
    reinvestedAmount: cleanReinvested,
    status: (isMarkedSold ? 'sold' : 'in_stock') as
      | 'in_stock'
      | 'sold'
      | 'restock_ordered',
    notes: (form.notes || '').trim().slice(0, 500),
  };
}
