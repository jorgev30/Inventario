import React from 'react';
import { X, CheckCircle2, FileSpreadsheet } from 'lucide-react';

interface ExcelComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreExcelSeed: () => Promise<void>;
  restoring: boolean;
}

export const ExcelComparisonModal: React.FC<ExcelComparisonModalProps> = ({
  isOpen,
  onClose,
  onRestoreExcelSeed,
  restoring,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl max-w-4xl w-full overflow-hidden my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Tu Hoja de Excel Original vs. Gestor en Tiempo Real
              </h2>
              <p className="text-xs text-slate-500">
                Todas tus columnas (A–J) están integradas con fórmulas automáticas y alertas de stock
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
          <div>
            <div className="text-xs font-semibold text-slate-700 mb-2">
              Captura de tu Excel actual importado al sistema:
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-100">
              <img
                src="/assets/aistudio/image_50386f56.png"
                alt="Captura de hoja de cálculo Excel de inventario"
                referrerPolicy="no-referrer"
                className="w-full h-auto object-contain max-h-80"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-xl p-4 space-y-2.5">
              <h3 className="text-xs font-semibold text-slate-900">
                Problemas detectados en tu Excel que ya corregimos:
              </h3>
              <ul className="space-y-2 text-xs text-slate-600">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Error &ldquo;-46275&rdquo; en Días en Inventario (Columna I, Fila 2):</strong>{' '}
                    En Excel la fórmula <code>=H2-A2</code> daba <code>-46275</code> cuando la Fecha de Venta estaba vacía. Ahora el sistema calcula los días, horas y minutos transcurridos en tiempo real si sigue en stock, o congela los días exactos al venderse.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Fila 4 sin margen de ganancia ($ 48,000 costo vs $ 48,000 venta):</strong>{' '}
                    El gestor señala automáticamente cuando un producto tiene utilidad $0 para que ajustes su precio de venta.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Alertas Automáticas de Stock Mínimo:</strong>{' '}
                    La Tablet 11&Prime; (agotada tras venderse) y el Set de Jarrones (1 unidad disponible) activan alertas de reabastecimiento con cálculo automático del capital requerido.
                  </span>
                </li>
              </ul>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 space-y-2.5 bg-slate-50/50">
              <h3 className="text-xs font-semibold text-slate-900">
                Equivalencia exacta de columnas (A hasta J):
              </h3>
              <div className="space-y-1.5 text-xs text-slate-600 font-mono">
                <div>Col A · Fecha → Fecha de Ingreso (dd-mes-aa)</div>
                <div>Col B · Artículo → Foto + Nombre + SKU + Categoría</div>
                <div>Col C · Precio Unitario → Costo unitario de compra</div>
                <div>Col D · Cantidad → Stock actual + Stock Mínimo</div>
                <div>Col E · Total → Automático (Precio Unitario × Cantidad)</div>
                <div>Col F · Precio de venta → Total Lote y Unitario</div>
                <div>Col G · Utilidad → Automático (Precio venta − Total)</div>
                <div>Col H · Fecha de Venta → Registro en 1 clic</div>
                <div>Col I · Días en Inventario → Reloj en vivo al segundo</div>
                <div>Col J · Dinero reinvertido → Control de capital</div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              disabled={restoring}
              onClick={async () => {
                await onRestoreExcelSeed();
                onClose();
              }}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
            >
              {restoring
                ? 'Cargando artículos...'
                : 'Volver a cargar los 3 artículos originales de mi Excel'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Entendido, volver al inventario
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
