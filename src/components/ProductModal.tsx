import React, { useState, useEffect } from 'react';
import { X, Upload, Calculator, CheckCircle2, Package } from 'lucide-react';
import { Product, ProductFormValues } from '../types';
import { formatCOP, isProductSold } from '../utils/calculations';
import { DINO_TRUCK_SVG, TABLET_PRO_SVG, CERAMIC_VASES_SVG } from '../data/excelSeed';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (values: ProductFormValues) => Promise<void>;
  initialProduct?: Product | null;
}

const DEFAULT_CATEGORIES = [
  'Juguetes y Recreación',
  'Tecnología y Tablets',
  'Hogar y Decoración',
  'Electrodomésticos',
  'Moda y Accesorios',
  'General',
];

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialProduct,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState<ProductFormValues>({
    name: '',
    sku: `ART-${String(Math.floor(100 + Math.random() * 900))}`,
    category: 'General',
    imageUrl: '',
    entryDate: todayStr,
    saleDate: '',
    unitCost: 0,
    quantity: 1,
    initialQuantity: 1,
    soldQuantity: 0,
    minStock: 2,
    unitSalePrice: 0,
    totalSalePrice: 0,
    reinvestedAmount: 0,
    status: 'in_stock',
    notes: '',
  });

  const [pricingMode, setPricingMode] = useState<'total_batch' | 'per_unit'>('total_batch');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (initialProduct) {
      const sold = isProductSold(initialProduct);
      setForm({
        name: initialProduct.name,
        sku: initialProduct.sku,
        category: initialProduct.category,
        imageUrl: initialProduct.imageUrl,
        entryDate: initialProduct.entryDate,
        saleDate: initialProduct.saleDate,
        unitCost: initialProduct.unitCost,
        quantity: sold ? 0 : initialProduct.quantity,
        initialQuantity: initialProduct.initialQuantity,
        soldQuantity: sold
          ? Math.max(1, initialProduct.soldQuantity || initialProduct.initialQuantity)
          : initialProduct.soldQuantity,
        minStock: initialProduct.minStock,
        unitSalePrice: initialProduct.unitSalePrice,
        totalSalePrice: initialProduct.totalSalePrice,
        reinvestedAmount: initialProduct.reinvestedAmount,
        status: sold ? 'sold' : initialProduct.status,
        notes: initialProduct.notes,
      });
    } else {
      setForm({
        name: '',
        sku: `ART-${String(Math.floor(100 + Math.random() * 900))}`,
        category: 'General',
        imageUrl: '',
        entryDate: todayStr,
        saleDate: '',
        unitCost: 0,
        quantity: 1,
        initialQuantity: 1,
        soldQuantity: 0,
        minStock: 2,
        unitSalePrice: 0,
        totalSalePrice: 0,
        reinvestedAmount: 0,
        status: 'in_stock',
        notes: '',
      });
    }
    setErrorMsg('');
  }, [initialProduct, isOpen, todayStr]);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 220;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
        } else {
          if (h > maxDim) {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          setForm((prev) => ({ ...prev, imageUrl: compressedDataUrl }));
        }
      };
      if (typeof ev.target?.result === 'string') {
        img.src = ev.target.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleStatusSwitch = (targetStatus: 'in_stock' | 'sold') => {
    if (targetStatus === 'sold') {
      setForm((prev) => ({
        ...prev,
        status: 'sold',
        quantity: 0,
        soldQuantity: Math.max(1, prev.initialQuantity),
        saleDate: prev.saleDate || todayStr,
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        status: 'in_stock',
        quantity: Math.max(1, prev.initialQuantity),
        soldQuantity: 0,
        saleDate: '',
      }));
    }
  };

  const handleInitialQuantityChange = (newInitQty: number) => {
    const safeInit = Math.max(1, newInitQty);
    setForm((prev) => {
      const nextTotalSale =
        pricingMode === 'per_unit'
          ? prev.unitSalePrice * safeInit
          : prev.totalSalePrice;
      const nextUnitSale =
        pricingMode === 'total_batch'
          ? Math.round((prev.totalSalePrice / safeInit) * 100) / 100
          : prev.unitSalePrice;
      const isCurrentlySold = prev.status === 'sold';
      return {
        ...prev,
        initialQuantity: safeInit,
        quantity: isCurrentlySold ? 0 : safeInit,
        soldQuantity: isCurrentlySold ? safeInit : prev.soldQuantity,
        totalSalePrice: nextTotalSale,
        unitSalePrice: nextUnitSale,
      };
    });
  };

  const handleTotalSalePriceChange = (val: number) => {
    const safeTotal = Math.max(0, val);
    const safeInit = Math.max(1, form.initialQuantity);
    setForm((prev) => ({
      ...prev,
      totalSalePrice: safeTotal,
      unitSalePrice: Math.round((safeTotal / safeInit) * 100) / 100,
    }));
  };

  const handleUnitSalePriceChange = (val: number) => {
    const safeUnit = Math.max(0, val);
    const safeInit = Math.max(1, form.initialQuantity);
    setForm((prev) => ({
      ...prev,
      unitSalePrice: safeUnit,
      totalSalePrice: Math.round(safeUnit * safeInit * 100) / 100,
    }));
  };

  const handleSaleDateChange = (dateVal: string) => {
    if (dateVal && dateVal.trim().length >= 8) {
      setForm((prev) => ({
        ...prev,
        saleDate: dateVal,
        status: 'sold',
        quantity: 0,
        soldQuantity: Math.max(1, prev.initialQuantity),
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        saleDate: '',
        status: 'in_stock',
        quantity: Math.max(1, prev.initialQuantity),
        soldQuantity: 0,
      }));
    }
  };

  const totalCost = form.unitCost * Math.max(1, form.initialQuantity);
  const expectedProfit = form.totalSalePrice - totalCost;
  const marginPct = totalCost > 0 ? (expectedProfit / totalCost) * 100 : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setErrorMsg('Ingresa el nombre del artículo.');
      return;
    }
    setSaving(true);
    setErrorMsg('');
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar el producto');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full overflow-hidden my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/60">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {initialProduct
                ? 'Editar Artículo / Estado de Venta'
                : 'Registrar Nuevo Artículo (Formato Excel)'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Puedes editar cualquier columna (A–J) o cambiar el artículo entre &ldquo;En Stock&rdquo; y &ldquo;Vendido&rdquo;
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {errorMsg}
            </div>
          )}

          {/* Status Selector: En Stock vs Vendido */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-900">
                Estado del Artículo (Pestaña de Destino)
              </div>
              <div className="text-[11px] text-slate-500">
                {form.status === 'sold'
                  ? 'Este registro se mostrará en la pestaña "Vendidos"'
                  : 'Este registro se mostrará en la pestaña "En Stock"'}
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => handleStatusSwitch('in_stock')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  form.status !== 'sold'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                En Stock
              </button>
              <button
                type="button"
                onClick={() => handleStatusSwitch('sold')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  form.status === 'sold'
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Vendido (Ir a Vendidos)
              </button>
            </div>
          </div>

          {/* Product Identity & Photo */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <div className="md:col-span-3 flex flex-col items-center gap-2">
              <div className="w-24 h-24 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
                {form.imageUrl ? (
                  <img
                    src={form.imageUrl}
                    alt={form.name || 'Vista previa'}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-[11px] text-slate-400 text-center px-2">
                    Sin foto
                  </span>
                )}
              </div>
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap">
                <Upload className="w-3.5 h-3.5" />
                Subir Imagen
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, imageUrl: DINO_TRUCK_SVG }))}
                  className="hover:text-slate-700 underline"
                >
                  Icono 1
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, imageUrl: TABLET_PRO_SVG }))}
                  className="hover:text-slate-700 underline"
                >
                  Icono 2
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, imageUrl: CERAMIC_VASES_SVG }))}
                  className="hover:text-slate-700 underline"
                >
                  Icono 3
                </button>
              </div>
            </div>

            <div className="md:col-span-9 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Artículo / Descripción del Producto (Columna B) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={150}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej. Pista Camión Dinosaurio Transportador"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Categoría
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-slate-900"
                >
                  {DEFAULT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Código / SKU
                </label>
                <input
                  type="text"
                  maxLength={50}
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Dates & Stock Thresholds */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Fecha Ingreso (Col A)
              </label>
              <input
                type="date"
                required
                value={form.entryDate}
                onChange={(e) => setForm({ ...form, entryDate: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Cantidad Lote (Col D)
              </label>
              <input
                type="number"
                min={1}
                required
                value={form.initialQuantity}
                onChange={(e) => handleInitialQuantityChange(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Stock Disponible Hoy
              </label>
              <input
                type="number"
                min={0}
                required
                value={form.quantity}
                onChange={(e) => {
                  const q = Math.max(0, Number(e.target.value));
                  setForm((prev) => ({
                    ...prev,
                    quantity: q,
                    status: q === 0 ? 'sold' : 'in_stock',
                    soldQuantity: q === 0 ? Math.max(1, prev.initialQuantity) : prev.soldQuantity,
                    saleDate: q === 0 ? prev.saleDate || todayStr : '',
                  }));
                }}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-amber-800 mb-1">
                Stock Mínimo (Alerta)
              </label>
              <input
                type="number"
                min={0}
                required
                value={form.minStock}
                onChange={(e) =>
                  setForm({ ...form, minStock: Math.max(0, Number(e.target.value)) })
                }
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-amber-300 bg-amber-50/40 rounded-lg focus:outline-none focus:border-amber-600"
              />
            </div>
          </div>

          {/* Financial Columns (Excel Cols C, E, F, G, H, J) */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">
                Cálculo de Costos, Precio de Venta y Utilidad (Columnas C a J)
              </span>
              <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPricingMode('total_batch')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    pricingMode === 'total_batch'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Precio Venta por Lote (Como en tu Excel)
                </button>
                <button
                  type="button"
                  onClick={() => setPricingMode('per_unit')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    pricingMode === 'per_unit'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Precio Venta por Unidad
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Precio Unitario Costo (Col C)
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  required
                  value={form.unitCost || ''}
                  onChange={(e) =>
                    setForm({ ...form, unitCost: Math.max(0, Number(e.target.value)) })
                  }
                  placeholder="39000"
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>

              {pricingMode === 'total_batch' ? (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Precio de Venta Total (Col F)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    required
                    value={form.totalSalePrice || ''}
                    onChange={(e) => handleTotalSalePriceChange(Number(e.target.value))}
                    placeholder="240000"
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                  <span className="text-[11px] text-slate-500 font-mono">
                    Equivale a {formatCOP(form.unitSalePrice)} c/u
                  </span>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Precio de Venta Unitario
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    required
                    value={form.unitSalePrice || ''}
                    onChange={(e) => handleUnitSalePriceChange(Number(e.target.value))}
                    placeholder="80000"
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                  <span className="text-[11px] text-slate-500 font-mono">
                    Total lote (Col F): {formatCOP(form.totalSalePrice)}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Dinero Reinvertido (Col J)
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={form.reinvestedAmount || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      reinvestedAmount: Math.max(0, Number(e.target.value)),
                    })
                  }
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>

            {/* Live Formula Preview Box matching Excel Columns E and G */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-3 gap-4">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Total Costo (Col E)</span>
                </div>
                <div className="text-sm font-semibold font-mono tabular-nums text-slate-900 mt-1">
                  {formatCOP(totalCost)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Precio de Venta (Col F)</div>
                <div className="text-sm font-semibold font-mono tabular-nums text-slate-900 mt-1">
                  {formatCOP(form.totalSalePrice)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Utilidad Neta (Col G)</div>
                <div
                  className={`text-sm font-semibold font-mono tabular-nums mt-1 ${
                    expectedProfit > 0
                      ? 'text-emerald-700'
                      : expectedProfit < 0
                      ? 'text-red-600'
                      : 'text-slate-700'
                  }`}
                >
                  {formatCOP(expectedProfit)}{' '}
                  <span className="text-xs font-normal">
                    ({marginPct >= 0 ? '+' : ''}
                    {marginPct.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sale Date & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Fecha de Venta (Col H — al poner fecha pasa a Vendidos)
              </label>
              <input
                type="date"
                value={form.saleDate}
                onChange={(e) => handleSaleDateChange(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Notas u Observaciones
              </label>
              <input
                type="text"
                maxLength={500}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Proveedor, detalles de entrega o preventa..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {saving
                ? 'Guardando...'
                : initialProduct
                ? 'Guardar Cambios'
                : 'Agregar al Inventario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
