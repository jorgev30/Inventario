import { ProductFormValues } from '../types';

// High-precision SVG data URIs representing the exact 3 products from the user's Excel sheet
export const DINO_TRUCK_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" fill="none">
  <rect width="160" height="160" rx="18" fill="#F1F5F9"/>
  <rect x="8" y="8" width="144" height="144" rx="14" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
  <!-- Dino Truck Body -->
  <path d="M24 72C24 58 36 48 50 48H82V94H24V72Z" fill="#4ADE80" stroke="#16A34A" stroke-width="2.5"/>
  <!-- Dino Head & Teeth -->
  <path d="M18 66C18 54 28 46 40 46H52V78H18V66Z" fill="#22C55E" stroke="#15803D" stroke-width="2"/>
  <circle cx="32" cy="57" r="4" fill="#0F172A"/>
  <circle cx="33" cy="56" r="1.5" fill="#FFFFFF"/>
  <!-- Ramp Slide -->
  <path d="M68 52L126 26L134 34L76 62Z" fill="#84CC16" stroke="#4D7C0F" stroke-width="2"/>
  <path d="M36 122L118 82L124 90L42 130Z" fill="#3B82F6" stroke="#1D4ED8" stroke-width="2"/>
  <!-- Mini Cars -->
  <rect x="38" y="96" width="18" height="10" rx="3" fill="#EF4444"/>
  <rect x="64" y="88" width="18" height="10" rx="3" fill="#F59E0B"/>
  <rect x="92" y="64" width="18" height="10" rx="3" fill="#2563EB"/>
  <!-- Truck Wheels -->
  <circle cx="42" cy="96" r="9" fill="#1E293B" stroke="#94A3B8" stroke-width="3"/>
  <circle cx="72" cy="96" r="9" fill="#1E293B" stroke="#94A3B8" stroke-width="3"/>
  <!-- Badge "3" from Excel image -->
  <circle cx="118" cy="116" r="22" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2"/>
  <text x="118" y="124" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="22" fill="#0F172A">3</text>
</svg>
`)}`;

export const TABLET_PRO_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" fill="none">
  <rect width="160" height="160" rx="18" fill="#F1F5F9"/>
  <rect x="8" y="8" width="144" height="144" rx="14" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
  <!-- Back Case -->
  <rect x="44" y="20" width="84" height="58" rx="5" fill="#334155"/>
  <!-- Main 11" Tablet Screen -->
  <rect x="32" y="28" width="86" height="58" rx="5" fill="#0F172A" stroke="#475569" stroke-width="2"/>
  <!-- Screen Vibrant Graphic -->
  <path d="M36 32H114V82H36V32Z" fill="#1E1B4B"/>
  <circle cx="75" cy="57" r="20" fill="#EC4899" fill-opacity="0.5"/>
  <circle cx="85" cy="52" r="16" fill="#3B82F6" fill-opacity="0.6"/>
  <text x="42" y="44" font-family="sans-serif" font-weight="700" font-size="9" fill="#FFFFFF">11"</text>
  <text x="58" y="70" font-family="sans-serif" font-weight="700" font-size="8" fill="#38BDF8">Android 16</text>
  <text x="52" y="79" font-family="monospace" font-weight="700" font-size="7" fill="#FDE047">32GB+128GB</text>
  <!-- Detachable Keyboard -->
  <path d="M26 92H124L132 118H18L26 92Z" fill="#1E293B" stroke="#0F172A" stroke-width="2"/>
  <line x1="28" y1="99" x2="122" y2="99" stroke="#64748B" stroke-width="2" stroke-dasharray="4 3"/>
  <line x1="25" y1="106" x2="125" y2="106" stroke="#64748B" stroke-width="2" stroke-dasharray="4 3"/>
  <line x1="22" y1="113" x2="128" y2="113" stroke="#64748B" stroke-width="2" stroke-dasharray="6 3"/>
  <!-- Accessories Row (Case, Charger, Mouse, Stylus) -->
  <rect x="36" y="126" width="12" height="16" rx="2" fill="#0F172A"/>
  <rect x="56" y="126" width="12" height="16" rx="2" fill="#334155"/>
  <rect x="78" y="128" width="10" height="14" rx="5" fill="#1E293B"/>
  <line x1="102" y1="126" x2="102" y2="142" stroke="#475569" stroke-width="3" stroke-linecap="round"/>
</svg>
`)}`;

export const CERAMIC_VASES_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" fill="none">
  <rect width="160" height="160" rx="18" fill="#F1F5F9"/>
  <rect x="8" y="8" width="144" height="144" rx="14" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
  <!-- Tall Terracotta Red Vase -->
  <path d="M64 38H78V48C84 54 86 68 85 126H57C56 68 58 54 64 48V38Z" fill="#7F1D1D" stroke="#450A0A" stroke-width="2"/>
  <path d="M56 42C50 42 50 52 58 52" stroke="#7F1D1D" stroke-width="3.5" stroke-linecap="round"/>
  <!-- Medium Olive-Brown Ribbed Vase -->
  <path d="M88 60H104V68C110 74 112 90 110 132H82C80 90 82 74 88 68V60Z" fill="#57534E" stroke="#292524" stroke-width="2"/>
  <path d="M104 64C112 64 112 74 104 74" stroke="#57534E" stroke-width="3.5" stroke-linecap="round"/>
  <line x1="84" y1="84" x2="108" y2="84" stroke="#44403C" stroke-width="1.5"/>
  <line x1="84" y1="96" x2="108" y2="96" stroke="#44403C" stroke-width="1.5"/>
  <line x1="84" y1="108" x2="108" y2="108" stroke="#44403C" stroke-width="1.5"/>
  <!-- Small Cream Pitcher Vase -->
  <path d="M50 90H66V96C72 102 72 118 68 134H46C42 118 44 102 50 96V90Z" fill="#E7E5E4" stroke="#A8A29E" stroke-width="2"/>
  <path d="M48 96C40 96 40 108 46 110" stroke="#A8A29E" stroke-width="3" stroke-linecap="round"/>
</svg>
`)}`;

export const INITIAL_EXCEL_PRODUCTS: ProductFormValues[] = [
  {
    name: 'Pista Camión Dinosaurio Transportador (Lote x3)',
    sku: 'JUG-DINO-001',
    category: 'Juguetes y Recreación',
    imageUrl: DINO_TRUCK_SVG,
    entryDate: '2026-09-10',
    saleDate: '',
    unitCost: 39000,
    quantity: 3,
    initialQuantity: 3,
    soldQuantity: 0,
    minStock: 2,
    unitSalePrice: 80000,
    totalSalePrice: 240000,
    reinvestedAmount: 0,
    status: 'in_stock',
    notes: 'Importado de fila 2 del Excel. En Excel mostraba -46275 días por celda de fecha de venta vacía; corregido a cálculo en tiempo real.',
  },
  {
    name: 'Tablet 11" Android 16 32GB+128GB con Teclado y Accesorios',
    sku: 'TEC-TAB11-002',
    category: 'Tecnología y Tablets',
    imageUrl: TABLET_PRO_SVG,
    entryDate: '2026-09-10',
    saleDate: '2026-08-26',
    unitCost: 251000,
    quantity: 0,
    initialQuantity: 1,
    soldQuantity: 1,
    minStock: 1,
    unitSalePrice: 400000,
    totalSalePrice: 400000,
    reinvestedAmount: 251000,
    status: 'sold',
    notes: 'Importado de fila 3 del Excel. Vendida por $400,000 con utilidad neta de $149,000. Stock agotado (alerta de reabastecimiento activa).',
  },
  {
    name: 'Set x3 Jarrones Cerámica Rústica Artesanal',
    sku: 'HOG-JAR-003',
    category: 'Hogar y Decoración',
    imageUrl: CERAMIC_VASES_SVG,
    entryDate: '2026-09-10',
    saleDate: '',
    unitCost: 48000,
    quantity: 1,
    initialQuantity: 1,
    soldQuantity: 0,
    minStock: 2,
    unitSalePrice: 48000,
    totalSalePrice: 48000,
    reinvestedAmount: 0,
    status: 'in_stock',
    notes: 'Importado de fila 4 del Excel. Precio de venta actualmente al costo ($48,000, utilidad $0). Stock por debajo del mínimo recomendado (2 uds).',
  },
];
