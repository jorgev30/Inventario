import React, { useState, useMemo } from 'react';
import { Download, Calendar, TrendingUp, DollarSign, Clock, RefreshCw } from 'lucide-react';
import { Product, Movement } from '../types';
import {
  buildMonthlyReports,
  calculateProductMetrics,
  calculateInventoryTime,
  formatCOP,
  formatCOPCompact,
  formatExcelDate,
  formatMonthKey,
} from '../utils/calculations';

interface MonthlyReportsViewProps {
  products: Product[];
  movements: Movement[];
  now: Date;
}

export const MonthlyReportsView: React.FC<MonthlyReportsViewProps> = ({
  products,
  movements,
  now,
}) => {
  const monthlyRows = useMemo(
    () => buildMonthlyReports(products, movements, now),
    [products, movements, now]
  );

  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');

  const filteredProducts = useMemo(() => {
    if (selectedMonth === 'ALL') return products;
    return products.filter(
      (p) =>
        p.entryDate.startsWith(selectedMonth) ||
        (p.saleDate && p.saleDate.startsWith(selectedMonth))
    );
  }, [products, selectedMonth]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        category: string;
        count: number;
        totalInvested: number;
        totalSalePrice: number;
        totalProfit: number;
        reinvested: number;
      }
    >();

    filteredProducts.forEach((p) => {
      const m = calculateProductMetrics(p);
      const existing = map.get(p.category) || {
        category: p.category,
        count: 0,
        totalInvested: 0,
        totalSalePrice: 0,
        totalProfit: 0,
        reinvested: 0,
      };
      existing.count += 1;
      existing.totalInvested += m.totalBatchCost;
      existing.totalSalePrice += m.totalSalePrice;
      existing.totalProfit += m.totalProfit;
      existing.reinvested += p.reinvestedAmount || 0;
      map.set(p.category, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.totalProfit - a.totalProfit);
  }, [filteredProducts]);

  const totals = useMemo(() => {
    return filteredProducts.reduce(
      (acc, p) => {
        const m = calculateProductMetrics(p);
        const t = calculateInventoryTime(p.entryDate, p.saleDate, p.quantity, now);
        acc.invested += m.totalBatchCost;
        acc.projectedRevenue += m.totalSalePrice;
        acc.projectedProfit += m.totalProfit;
        acc.realizedRevenue += m.realizedRevenue;
        acc.realizedProfit += m.realizedProfit;
        acc.reinvested += p.reinvestedAmount || 0;
        acc.daysSum += t.days;
        return acc;
      },
      {
        invested: 0,
        projectedRevenue: 0,
        projectedProfit: 0,
        realizedRevenue: 0,
        realizedProfit: 0,
        reinvested: 0,
        daysSum: 0,
      }
    );
  }, [filteredProducts, now]);

  const avgDays =
    filteredProducts.length > 0
      ? Math.round(totals.daysSum / filteredProducts.length)
      : 0;

  const handleExportMonthlyCSV = () => {
    const headers = [
      'Mes',
      'Fecha Ingreso',
      'Articulo',
      'SKU',
      'Categoria',
      'Precio Unitario',
      'Cantidad Lote',
      'Stock Actual',
      'Total Costo',
      'Precio de Venta',
      'Utilidad Proyectada',
      'Utilidad Realizada',
      'Fecha de Venta',
      'Dias en Inventario',
      'Dinero Reinvertido',
    ];

    const rows = filteredProducts.map((p) => {
      const m = calculateProductMetrics(p);
      const t = calculateInventoryTime(p.entryDate, p.saleDate, p.quantity, now);
      return [
        p.entryDate.slice(0, 7),
        p.entryDate,
        `"${p.name.replace(/"/g, '""')}"`,
        p.sku,
        `"${p.category}"`,
        p.unitCost,
        p.initialQuantity,
        p.quantity,
        m.totalBatchCost,
        m.totalSalePrice,
        m.totalProfit,
        m.realizedProfit,
        p.saleDate || 'En Stock',
        t.days,
        p.reinvestedAmount || 0,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `reporte_mensual_inventario_${selectedMonth.toLowerCase()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Toolbar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Reportes Financieros y Rotación Mensual
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Consolidado de inversión, ganancias proyectadas vs. realizadas, días promedio en stock y dinero reinvertido.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-slate-900"
            >
              <option value="ALL">Todos los periodos ({products.length} registros)</option>
              {monthlyRows.map((m) => (
                <option key={m.monthKey} value={m.monthKey}>
                  {m.monthLabel} ({m.productsAddedCount} lotes)
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleExportMonthlyCSV}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar Reporte a Excel (CSV)
          </button>
        </div>
      </div>

      {/* Period Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Inversión Total en Lotes (Col E)</span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-2">
            {formatCOP(totals.invested)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Valor total venta (Col F):{' '}
            <span className="font-mono font-medium text-slate-800">
              {formatCOPCompact(totals.projectedRevenue)}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Utilidad Total del Periodo (Col G)</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-700 mt-2">
            {formatCOP(totals.projectedProfit)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Ya cobrada en ventas:{' '}
            <span className="font-mono font-medium text-emerald-700">
              {formatCOPCompact(totals.realizedProfit)}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Dinero Reinvertido (Col J)</span>
            <RefreshCw className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-2">
            {formatCOP(totals.reinvested)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Caja libre tras reinversión:{' '}
            <span className="font-mono font-medium text-slate-800">
              {formatCOPCompact(Math.max(0, totals.realizedRevenue - totals.reinvested))}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Promedio Días en Inventario (Col I)</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-2">
            {avgDays} {avgDays === 1 ? 'día' : 'días'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Calculado en tiempo real al {formatExcelDate(now.toISOString().slice(0, 10))}
          </div>
        </div>
      </div>

      {/* Month-by-Month Consolidated Matrix */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              01. Consolidado Mensual de Inventario y Utilidades
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparativa mensual de capital invertido, ventas, ganancias y reinversión
            </p>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {monthlyRows.length} {monthlyRows.length === 1 ? 'mes registrado' : 'meses registrados'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-600">
                <th className="py-3 px-4">Mes / Periodo</th>
                <th className="py-3 px-4 text-right">Lotes / Uds</th>
                <th className="py-3 px-4 text-right">Costo Total (Col E)</th>
                <th className="py-3 px-4 text-right">Precio Venta (Col F)</th>
                <th className="py-3 px-4 text-right">Utilidad Total (Col G)</th>
                <th className="py-3 px-4 text-right">Margen ROI</th>
                <th className="py-3 px-4 text-right">Ventas Cobradas</th>
                <th className="py-3 px-4 text-right">Utilidad Cobrada</th>
                <th className="py-3 px-4 text-right">Reinvertido (Col J)</th>
                <th className="py-3 px-4 text-right">Rotación Prom.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {monthlyRows.map((row) => (
                <tr
                  key={row.monthKey}
                  onClick={() =>
                    setSelectedMonth(
                      selectedMonth === row.monthKey ? 'ALL' : row.monthKey
                    )
                  }
                  className={`cursor-pointer transition-colors ${
                    selectedMonth === row.monthKey
                      ? 'bg-slate-100/80 font-medium'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                    {row.monthLabel}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                    {row.productsAddedCount} lotes · {row.unitsPurchased} uds
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                    {formatCOP(row.totalInvestedCost)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                    {formatCOP(row.projectedBatchRevenue)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700 whitespace-nowrap">
                    {formatCOP(row.projectedBatchProfit)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                    +{row.roiPercent.toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                    {formatCOP(row.realizedSalesRevenue)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700 whitespace-nowrap">
                    {formatCOP(row.realizedNetProfit)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-blue-700 whitespace-nowrap">
                    {row.reinvestedCapital > 0 ? formatCOP(row.reinvestedCapital) : '$ -'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                    {row.avgDaysInInventory} días
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category Profitability Breakdown */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              02. Rentabilidad Detallada por Categoría ({selectedMonth === 'ALL' ? 'Todos los meses' : formatMonthKey(selectedMonth)})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Identifica qué líneas de producto generan mayor utilidad sobre el capital invertido
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-600">
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4 text-right">Artículos</th>
                <th className="py-3 px-4 text-right">Costo Total</th>
                <th className="py-3 px-4 text-right">Precio de Venta</th>
                <th className="py-3 px-4 text-right">Utilidad Neta</th>
                <th className="py-3 px-4 text-right">ROI s/Costo</th>
                <th className="py-3 px-4 text-right">Dinero Reinvertido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {categoryBreakdown.map((c) => {
                const roi =
                  c.totalInvested > 0 ? (c.totalProfit / c.totalInvested) * 100 : 0;
                return (
                  <tr key={c.category} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {c.category}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                      {c.count}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                      {formatCOP(c.totalInvested)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                      {formatCOP(c.totalSalePrice)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700">
                      {c.totalProfit > 0 ? formatCOP(c.totalProfit) : '$ -'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {roi.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-blue-700">
                      {c.reinvested > 0 ? formatCOP(c.reinvested) : '$ -'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
