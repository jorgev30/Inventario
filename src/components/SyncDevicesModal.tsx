import React, { useState } from 'react';
import {
  X,
  Smartphone,
  Monitor,
  Copy,
  Check,
  Cloud,
  LogIn,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { User } from 'firebase/auth';

interface SyncDevicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSignIn: () => Promise<void>;
  onUploadLocalToCloud: () => Promise<void>;
  uploading: boolean;
}

const SHARED_APP_URL =
  'https://ais-pre-hl6ajbao6rnu5gubruiogw-59118897929.us-west2.run.app';

export const SyncDevicesModal: React.FC<SyncDevicesModalProps> = ({
  isOpen,
  onClose,
  user,
  onSignIn,
  onUploadLocalToCloud,
  uploading,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const appUrl =
    typeof window !== 'undefined' && window.location.origin.includes('ais-pre')
      ? window.location.origin
      : SHARED_APP_URL;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full overflow-hidden my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-slate-900" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Usar y Editar desde tu Celular u Otro Computador
              </h2>
              <p className="text-xs text-slate-500">
                Sincronización en tiempo real en la nube con tu cuenta de Google
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

        <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {/* Step 1: Cloud Connection Status */}
          <div
            className={`border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              user
                ? 'bg-emerald-50/70 border-emerald-200'
                : 'bg-amber-50/80 border-amber-200'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                <Cloud
                  className={`w-4 h-4 ${
                    user ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                />
                <span>
                  {user
                    ? `Paso 1 Completado: Conectado como ${user.email}`
                    : 'Paso 1 (Importante): Inicia sesión con Google aquí primero'}
                </span>
              </div>
              <p className="text-xs text-slate-600">
                {user
                  ? 'Todos los cambios que hagas se guardan automáticamente en la nube (Firebase) y se actualizan al instante en cualquier celular o PC donde entres con este mismo correo.'
                  : 'Actualmente estás en "Modo vista previa local". Para que lo que edites aquí se vea en tu celular o en otro computador, conecta tu cuenta de Google.'}
              </p>
            </div>

            {!user ? (
              <button
                type="button"
                onClick={onSignIn}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <LogIn className="w-4 h-4" />
                Conectar mi Google Ahora
              </button>
            ) : (
              <button
                type="button"
                disabled={uploading}
                onClick={onUploadLocalToCloud}
                className="px-3.5 py-2 text-xs font-medium text-emerald-900 bg-emerald-200/70 hover:bg-emerald-200 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                {uploading
                  ? 'Sincronizando...'
                  : 'Forzar copia de seguridad ahora'}
              </button>
            )}
          </div>

          {/* Step 2: Public Link to Open on Phone or Other PC */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="text-xs font-semibold text-slate-900">
              Paso 2: Abre este enlace en el navegador de tu Celular o en otro Computador
            </div>
            <p className="text-xs text-slate-600">
              Copia este enlace y envíatelo por WhatsApp o correo para abrirlo en tu celular o en cualquier otro PC:
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                readOnly
                value={appUrl}
                className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-800 select-all"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Enlace Copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copiar Enlace
                  </>
                )}
              </button>
            </div>
            <div className="text-[11px] text-slate-500">
              Nota: Si estás dentro del editor de Google AI Studio, asegúrate de haber hecho clic en el botón <strong>Share (Compartir) → Publish</strong> arriba a la derecha para que el enlace público tenga esta última versión.
            </div>
          </div>

          {/* Step 3: How to Edit from Both Devices */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                <Smartphone className="w-4 h-4 text-emerald-700" />
                <span>Desde tu Celular (Android / iPhone)</span>
              </div>
              <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside">
                <li>Abre el enlace en <strong>Chrome</strong> o <strong>Safari</strong>.</li>
                <li>
                  Toca el botón <strong>&ldquo;Guardar con mi cuenta Google&rdquo;</strong> e ingresa con tu mismo correo (<code>jorgevillero7@gmail.com</code>).
                </li>
                <li>
                  Ya puedes registrar ventas, agregar productos o editar precios desde el celular y se actualizarán en vivo en tu PC.
                </li>
              </ol>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                <Monitor className="w-4 h-4 text-blue-700" />
                <span>Desde Otro Computador</span>
              </div>
              <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside">
                <li>Abre el mismo enlace en cualquier navegador.</li>
                <li>
                  Haz clic en <strong>&ldquo;Guardar con mi cuenta Google&rdquo;</strong> con el mismo correo de Google.
                </li>
                <li>
                  Verás exactamente los mismos productos, pestaña de <strong>Vendidos</strong> y reportes mensuales en tiempo real.
                </li>
              </ol>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-slate-600">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>Tip para celular:</strong> En la tabla de inventario desde el celular puedes deslizar hacia los lados (izquierda/derecha) para ver todas las columnas de la A a la J y tocar los botones <strong>Vender</strong>, <strong>+Stock</strong> o <strong>Editar</strong> cómodamente.
            </span>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
