import React, { useState, useEffect } from 'react';
import { X, ShoppingBag, PackagePlus, RefreshCw } from 'lucide-react';
import { Product } from '../types';
import { formatCOP, calculateProductMetrics, isProductSold } from '../utils/calculations';

interface RecordSaleModalProps {
  product: Product | null;
  onClose: () => void;
  onConfirmSale: (
    product: Product,
    unitsToSell: number,
    saleDate: string,
    unitSalePrice: number,
    reinvestedAmount: number,
    notes: string
  ) => Promise<void>;
}

export const RecordSaleModal: React.FC<RecordSaleModalProps> = ({
  product,
  onClose,
  onConfirmSale,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [unitsToSell, setUnitsToSell] = useState<number>(1);
  const [saleDate, setSaleDate] = useState<string>(todayStr);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [reinvested, setReinvested] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Sync state every time a product is selected
  useEffect(() => {
    if (product) {
      const alreadySold = isProductSold(product);
      const defaultUnits = alreadySold
        ? Math.max(1, product.soldQuantity || product.initialQuantity || 1)
        : Math.max(1, product.quantity || product.initialQuantity || 1);

      const defaultUnitPrice =
        product.unitSalePrice > 0
          ? product.unitSalePrice
          : product.totalSalePrice > 0
          ? Math.round(
              (product.totalSalePrice / Math.max(1, product.initialQuantity)) * 100
            ) / 100
          : 0;

      setUnitsToSell(defaultUnits);
      setSaleDate(product.saleDate || todayStr);
      setUnitPrice(defaultUnitPrice);
      setReinvested(product.reinvestedAmount || 0);
      setNotes('');
    }
  }, [product, todayStr]);

  if (!product) return null;

  const alreadySold = isProductSold(product);
  const maxSellableUnits = alreadySold
    ? Math.max(1, product.initialQuantity, product.soldQuantity)
    : Math.max(1, product.quantity);

  const totalSaleRevenue = unitsToSell * unitPrice;
  const totalUnitCost = unitsToSell * product.unitCost;
  const saleProfit = totalSaleRevenue - totalUnitCost;
  const remainingStock = alreadySold
    ? 0
    : Math.max(0, product.quantity - unitsToSell);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onConfirmSale(
        product,
        unitsToSell,
        saleDate,
        unitPrice,
        reinvested,
        notes
      );
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-emerald-700" />
            <h3 className="text-sm font-semibold text-slate-900">
              {alreadySold
                ? 'Editar Registro de Venta'
                : 'Registrar Venta (Pasar a Vendidos)'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <div className="text-xs text-slate-500">Producto seleccionado</div>
            <div className="text-sm font-semibold text-slate-900 mt-0.5">
              {product.name}
            </div>
            <div className="text-xs text-slate-500 font-mono mt-0.5">
              {alreadySold
                ? `Lote vendido: ${product.soldQuantity || product.initialQuantity} uds`
                : `Stock disponible: ${product.quantity} uds`}{' '}
              · Costo unitario: {formatCOP(product.unitCost)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Unidades Vendidas
              </label>
              <input
                type="number"
                min={1}
                max={alreadySold ? 9999 : maxSellableUnits}
                required
                value={unitsToSell}
                onChange={(e) => setUnitsToSell(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Fecha de Venta (Col H)
              </label>
              <input
                type="date"
                required
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Precio Venta Unitario
              </label>
              <input
                type="number"
                min={0}
                step="any"
                required
                value={unitPrice}
                onChange={(e) => setUnitPrice(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Dinero Reinvertido (Col J)
              </label>
              <input
                type="number"
                min={0}
                step="any"
                value={reinvested}
                onChange={(e) => setReinvested(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Total Venta (Col F):</span>
              <span className="font-mono font-semibold text-slate-900">
                {formatCOP(totalSaleRevenue)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Utilidad Neta (Col G):</span>
              <span
                className={`font-mono font-semibold ${
                  saleProfit >= 0 ? 'text-emerald-700' : 'text-red-600'
                }`}
              >
                {formatCOP(saleProfit)}
              </span>
            </div>
            {!alreadySold && (
              <div className="flex justify-between text-xs pt-1 border-t border-slate-200">
                <span className="text-slate-600">Destino del registro:</span>
                <span className="font-medium text-emerald-800">
                  {remainingStock === 0
                    ? 'Pasa directo a pestaña "Vendidos"'
                    : `Crea venta (${unitsToSell} ud) en "Vendidos" y deja ${remainingStock} en stock`}
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Nota de venta (opcional)
            </label>
            <input
              type="text"
              maxLength={250}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Cliente, canal de venta o método de pago..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-50"
            >
              {submitting
                ? 'Guardando...'
                : alreadySold
                ? 'Guardar Cambios de Venta'
                : 'Confirmar Venta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface RestockModalProps {
  product: Product | null;
  onClose: () => void;
  onConfirmRestock: (
    product: Product,
    addedUnits: number,
    newUnitCost: number,
    markAsReinvested: boolean,
    notes: string
  ) => Promise<void>;
}

export const RestockModal: React.FC<RestockModalProps> = ({
  product,
  onClose,
  onConfirmRestock,
}) => {
  const [addedUnits, setAddedUnits] = useState<number>(3);
  const [newUnitCost, setNewUnitCost] = useState<number>(0);
  const [markAsReinvested, setMarkAsReinvested] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (product) {
      const m = calculateProductMetrics(product);
      setAddedUnits(m.suggestedReorderQty > 0 ? m.suggestedReorderQty : 3);
      setNewUnitCost(product.unitCost || 0);
      setMarkAsReinvested(true);
      setNotes('');
    }
  }, [product]);

  if (!product) return null;

  const restockInvestment = addedUnits * newUnitCost;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onConfirmRestock(
        product,
        addedUnits,
        newUnitCost,
        markAsReinvested,
        notes
      );
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <PackagePlus className="w-4 h-4 text-slate-900" />
            <h3 className="text-sm font-semibold text-slate-900">
              Reabastecer Stock de Producto
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">{product.name}</div>
            <div className="text-xs text-slate-500 font-mono mt-0.5">
              Stock actual: {product.quantity} uds · Stock mínimo configurado:{' '}
              {product.minStock} uds
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Unidades a Ingresar
              </label>
              <input
                type="number"
                min={1}
                required
                value={addedUnits}
                onChange={(e) => setAddedUnits(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Costo Unitario (Col C)
              </label>
              <input
                type="number"
                min={0}
                step="any"
                required
                value={newUnitCost}
                onChange={(e) => setNewUnitCost(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={markAsReinvested}
              onChange={(e) => setMarkAsReinvested(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span className="flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              Sumar {formatCOP(restockInvestment)} a &ldquo;Dinero reinvertido&rdquo; (Col J)
            </span>
          </label>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Nuevo Stock Disponible:</span>
              <span className="font-mono font-semibold text-slate-900">
                {product.quantity + addedUnits} unidades
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Inversión de Reposición:</span>
              <span className="font-mono font-semibold text-slate-900">
                {formatCOP(restockInvestment)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Notas de reposición (opcional)
            </label>
            <input
              type="text"
              maxLength={250}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Proveedor o lote de compra..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting ? 'Actualizando...' : 'Confirmar Reabastecimiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
