import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Plus,
  Search,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  ShoppingBag,
  PackagePlus,
  Pencil,
  Trash2,
  LogIn,
  LogOut,
  Clock,
  CheckCircle2,
  ArrowUpDown,
  Smartphone,
} from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';
import { Product, Movement, ProductFormValues } from './types';
import { INITIAL_EXCEL_PRODUCTS } from './data/excelSeed';
import {
  formatCOP,
  formatCOPCompact,
  formatExcelDate,
  calculateInventoryTime,
  calculateProductMetrics,
  sanitizeProductPayload,
  isProductSold,
} from './utils/calculations';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProductModal } from './components/ProductModal';
import { RecordSaleModal, RestockModal } from './components/QuickActionModals';
import { MonthlyReportsView } from './components/MonthlyReportsView';
import { ExcelComparisonModal } from './components/ExcelComparisonModal';
import { SyncDevicesModal } from './components/SyncDevicesModal';

type ActiveTab = 'inventory' | 'alerts' | 'reports' | 'movements';
type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'sold';

function InventoryApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);

  // Cloud Firestore state (or local preview state before sign-in)
  const [cloudProducts, setCloudProducts] = useState<Product[]>([]);
  const [cloudMovements, setCloudMovements] = useState<Movement[]>([]);
  const [localProducts, setLocalProducts] = useState<Product[]>(() =>
    INITIAL_EXCEL_PRODUCTS.map((item, idx) => ({
      ...item,
      id: `excel_seed_${idx + 1}`,
      ownerId: 'preview_user',
    }))
  );
  const [localMovements, setLocalMovements] = useState<Movement[]>([
    {
      id: 'mov_seed_1',
      ownerId: 'preview_user',
      productId: 'excel_seed_2',
      productName: 'Tablet 11" Android 16 32GB+128GB con Teclado y Accesorios',
      type: 'sale',
      quantity: 1,
      unitCost: 251000,
      unitSalePrice: 400000,
      totalAmount: 400000,
      profit: 149000,
      reinvestedAmount: 251000,
      date: '2026-08-26',
      notes: 'Venta registrada en hoja de Excel (Fila 3)',
    },
  ]);

  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [seedingInitial, setSeedingInitial] = useState<boolean>(false);
  const hasAutoSeededRef = useRef<boolean>(false);

  // Real-time clock for live "Días en Inventario" counter
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Navigation & Filters
  const [activeTab, setActiveTab] = useState<ActiveTab>('inventory');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'entryDate' | 'profit' | 'days' | 'name'>('entryDate');

  // Modals & Toast Feedback
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saleTargetProduct, setSaleTargetProduct] = useState<Product | null>(null);
  const [restockTargetProduct, setRestockTargetProduct] = useState<Product | null>(null);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState<boolean>(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const [authBannerError, setAuthBannerError] = useState<string>('');
  const [feedbackNotice, setFeedbackNotice] = useState<string>('');

  const showNotice = (msg: string) => {
    setFeedbackNotice(msg);
    setTimeout(() => {
      setFeedbackNotice((prev) => (prev === msg ? '' : prev));
    }, 5000);
  };

  // Track Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Attach Firestore listeners when authenticated
  useEffect(() => {
    if (!authReady || !user) {
      setCloudProducts([]);
      setCloudMovements([]);
      return;
    }

    setLoadingData(true);
    const productsQuery = query(
      collection(db, 'products'),
      where('ownerId', '==', user.uid)
    );

    const unsubProducts = onSnapshot(
      productsQuery,
      async (snapshot) => {
        const items: Product[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Product, 'id'>),
        }));
        setCloudProducts(items);
        setLoadingData(false);

        if (items.length === 0 && !hasAutoSeededRef.current && user.emailVerified) {
          hasAutoSeededRef.current = true;
          await uploadProductsListToFirestore(user.uid, localProducts);
        }
      },
      (error) => {
        setLoadingData(false);
        handleFirestoreError(error, OperationType.LIST, 'products');
      }
    );

    const movementsQuery = query(
      collection(db, 'movements'),
      where('ownerId', '==', user.uid)
    );

    const unsubMovements = onSnapshot(
      movementsQuery,
      (snapshot) => {
        const movs: Movement[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Movement, 'id'>),
        }));
        movs.sort((a, b) => b.date.localeCompare(a.date));
        setCloudMovements(movs);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'movements');
      }
    );

    return () => {
      unsubProducts();
      unsubMovements();
    };
  }, [authReady, user]);

  const uploadProductsListToFirestore = async (
    uid: string,
    sourceList: ProductFormValues[]
  ) => {
    setSeedingInitial(true);
    try {
      for (let i = 0; i < sourceList.length; i++) {
        const item = sourceList[i];
        const prodId = `excel_item_${i + 1}_${Date.now()}`;
        const cleanPayload = sanitizeProductPayload(item, uid);
        try {
          await setDoc(doc(db, 'products', prodId), {
            ...cleanPayload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `products/${prodId}`);
        }

        if (cleanPayload.status === 'sold' || cleanPayload.soldQuantity > 0) {
          const movId = `mov_init_${i + 1}_${Date.now()}`;
          try {
            await setDoc(doc(db, 'movements', movId), {
              ownerId: uid,
              productId: prodId,
              productName: cleanPayload.name,
              type: 'sale',
              quantity: cleanPayload.soldQuantity || 1,
              unitCost: cleanPayload.unitCost,
              unitSalePrice: cleanPayload.unitSalePrice,
              totalAmount: cleanPayload.totalSalePrice,
              profit:
                cleanPayload.totalSalePrice -
                cleanPayload.unitCost * cleanPayload.initialQuantity,
              reinvestedAmount: cleanPayload.reinvestedAmount,
              date: cleanPayload.saleDate || cleanPayload.entryDate,
              notes: 'Venta sincronizada en la nube',
              createdAt: serverTimestamp(),
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, `movements/${movId}`);
          }
        }
      }
    } finally {
      setSeedingInitial(false);
    }
  };

  const seedExcelProductsToFirestore = async (uid: string) => {
    await uploadProductsListToFirestore(uid, INITIAL_EXCEL_PRODUCTS);
  };

  const activeProducts = user ? cloudProducts : localProducts;
  const activeMovements = user ? cloudMovements : localMovements;

  const handleSignIn = async () => {
    setAuthBannerError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthBannerError(
        err instanceof Error ? err.message : 'No se pudo iniciar sesión con Google'
      );
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  // Create or Update Product via ProductModal ("Nuevo Artículo" or "Editar")
  const handleSaveProduct = async (values: ProductFormValues) => {
    const clean = sanitizeProductPayload(values, user ? user.uid : 'preview_user');

    if (!user) {
      if (editingProduct) {
        setLocalProducts((prev) =>
          prev.map((p) => (p.id === editingProduct.id ? { ...p, ...clean } : p))
        );
        showNotice(
          clean.status === 'sold'
            ? `"${clean.name}" actualizado y disponible en la pestaña Vendidos.`
            : `"${clean.name}" actualizado en inventario.`
        );
      } else {
        const newProd: Product = {
          id: `local_${Date.now()}`,
          ...clean,
        };
        setLocalProducts((prev) => [newProd, ...prev]);
        showNotice(`"${clean.name}" agregado al inventario.`);
      }
      setEditingProduct(null);
      return;
    }

    if (editingProduct) {
      const path = `products/${editingProduct.id}`;
      try {
        await updateDoc(doc(db, 'products', editingProduct.id), {
          name: clean.name,
          sku: clean.sku,
          category: clean.category,
          imageUrl: clean.imageUrl,
          entryDate: clean.entryDate,
          saleDate: clean.saleDate,
          unitCost: clean.unitCost,
          quantity: clean.quantity,
          initialQuantity: clean.initialQuantity,
          soldQuantity: clean.soldQuantity,
          minStock: clean.minStock,
          unitSalePrice: clean.unitSalePrice,
          totalSalePrice: clean.totalSalePrice,
          reinvestedAmount: clean.reinvestedAmount,
          status: clean.status,
          notes: clean.notes,
          updatedAt: serverTimestamp(),
        });
        showNotice(
          clean.status === 'sold'
            ? `"${clean.name}" actualizado y movido a la pestaña Vendidos.`
            : `"${clean.name}" actualizado correctamente.`
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    } else {
      const newId = `prod_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const path = `products/${newId}`;
      try {
        await setDoc(doc(db, 'products', newId), {
          ...clean,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showNotice(`"${clean.name}" agregado al inventario.`);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    }
    setEditingProduct(null);
  };

  // Record a Sale or Edit an Existing Sale via RecordSaleModal ("Vender" or "Editar Venta")
  const handleConfirmSale = async (
    product: Product,
    unitsToSell: number,
    saleDate: string,
    unitSalePrice: number,
    reinvestedAmount: number,
    notes: string
  ) => {
    const alreadySold = isProductSold(product);
    const isPartialSale = !alreadySold && unitsToSell < product.quantity;

    // CASE 1: Editing an already sold item OR selling 100% of remaining stock
    if (alreadySold || !isPartialSale) {
      const finalUnitsSold = alreadySold
        ? Math.max(1, unitsToSell)
        : Math.max(1, product.initialQuantity);
      const nextTotalSalePrice = unitSalePrice * finalUnitsSold;
      const updatedNotes = notes
        ? `${product.notes ? product.notes + ' · ' : ''}Venta (${finalUnitsSold} uds): ${notes}`.slice(
            0,
            500
          )
        : product.notes;

      if (!user) {
        setLocalProducts((prev) =>
          prev.map((p) =>
            p.id === product.id
              ? {
                  ...p,
                  quantity: 0,
                  initialQuantity: finalUnitsSold,
                  soldQuantity: finalUnitsSold,
                  saleDate,
                  unitSalePrice,
                  totalSalePrice: nextTotalSalePrice,
                  reinvestedAmount,
                  status: 'sold',
                  notes: updatedNotes,
                }
              : p
          )
        );
        setLocalMovements((prev) => [
          {
            id: `mov_local_${Date.now()}`,
            ownerId: 'preview_user',
            productId: product.id,
            productName: product.name,
            type: 'sale',
            quantity: finalUnitsSold,
            unitCost: product.unitCost,
            unitSalePrice,
            totalAmount: nextTotalSalePrice,
            profit: finalUnitsSold * (unitSalePrice - product.unitCost),
            reinvestedAmount,
            date: saleDate,
            notes: (
              notes ||
              (alreadySold ? 'Registro de venta editado' : 'Venta registrada')
            ).slice(0, 300),
          },
          ...prev,
        ]);
        showNotice(
          alreadySold
            ? `Venta de "${product.name}" actualizada en la pestaña Vendidos.`
            : `Venta registrada: "${product.name}" se movió a la pestaña Vendidos.`
        );
        return;
      }

      const prodPath = `products/${product.id}`;
      try {
        await updateDoc(doc(db, 'products', product.id), {
          quantity: 0,
          initialQuantity: finalUnitsSold,
          soldQuantity: finalUnitsSold,
          saleDate: saleDate.slice(0, 30),
          unitSalePrice: Math.max(0, unitSalePrice),
          totalSalePrice: Math.max(0, nextTotalSalePrice),
          reinvestedAmount: Math.max(0, reinvestedAmount),
          status: 'sold',
          notes: updatedNotes,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, prodPath);
      }

      const movId = `mov_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const movPath = `movements/${movId}`;
      try {
        await setDoc(doc(db, 'movements', movId), {
          ownerId: user.uid,
          productId: product.id,
          productName: product.name.slice(0, 150),
          type: 'sale',
          quantity: finalUnitsSold,
          unitCost: Math.max(0, product.unitCost),
          unitSalePrice: Math.max(0, unitSalePrice),
          totalAmount: Math.max(0, nextTotalSalePrice),
          profit: finalUnitsSold * (unitSalePrice - product.unitCost),
          reinvestedAmount: Math.max(0, reinvestedAmount),
          date: saleDate.slice(0, 30),
          notes: (
            notes ||
            (alreadySold ? 'Venta editada en inventario' : 'Venta registrada en inventario')
          ).slice(0, 300),
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, movPath);
      }

      showNotice(
        alreadySold
          ? `Venta de "${product.name}" actualizada en la pestaña Vendidos.`
          : `Venta registrada: "${product.name}" ahora está en la pestaña Vendidos.`
      );
      return;
    }

    // CASE 2: Partial Sale (e.g., selling 1 unit out of 3 available in batch)
    // Keep remaining units in "En Stock" AND create a new sold record in "Vendidos"
    const remainingQty = product.quantity - unitsToSell;
    const remainingTotalSale = product.unitSalePrice * remainingQty;
    const soldBatchTotalSale = unitSalePrice * unitsToSell;
    const soldRecordNotes = notes
      ? `Venta parcial (${unitsToSell} uds): ${notes}`.slice(0, 500)
      : `Venta de ${unitsToSell} uds del lote original (${product.sku})`.slice(0, 500);

    if (!user) {
      const soldRecordId = `sold_local_${Date.now()}`;
      const newSoldProduct: Product = {
        ...product,
        id: soldRecordId,
        quantity: 0,
        initialQuantity: unitsToSell,
        soldQuantity: unitsToSell,
        saleDate,
        unitSalePrice,
        totalSalePrice: soldBatchTotalSale,
        reinvestedAmount,
        status: 'sold',
        notes: soldRecordNotes,
      };

      setLocalProducts((prev) => [
        newSoldProduct,
        ...prev.map((p) =>
          p.id === product.id
            ? {
                ...p,
                quantity: remainingQty,
                initialQuantity: remainingQty,
                soldQuantity: 0,
                totalSalePrice: remainingTotalSale,
                status: 'in_stock' as const,
              }
            : p
        ),
      ]);

      setLocalMovements((prev) => [
        {
          id: `mov_local_${Date.now()}`,
          ownerId: 'preview_user',
          productId: soldRecordId,
          productName: product.name,
          type: 'sale',
          quantity: unitsToSell,
          unitCost: product.unitCost,
          unitSalePrice,
          totalAmount: soldBatchTotalSale,
          profit: unitsToSell * (unitSalePrice - product.unitCost),
          reinvestedAmount,
          date: saleDate,
          notes: soldRecordNotes.slice(0, 300),
        },
        ...prev,
      ]);

      showNotice(
        `Venta parcial registrada: ${unitsToSell} ud(s) enviadas a "Vendidos" y quedan ${remainingQty} ud(s) en "En Stock".`
      );
      return;
    }

    // Update remaining stock in Firestore
    const prodPath = `products/${product.id}`;
    try {
      await updateDoc(doc(db, 'products', product.id), {
        quantity: remainingQty,
        initialQuantity: remainingQty,
        soldQuantity: 0,
        saleDate: '',
        unitSalePrice: Math.max(0, product.unitSalePrice),
        totalSalePrice: Math.max(0, remainingTotalSale),
        reinvestedAmount: Math.max(0, product.reinvestedAmount || 0),
        status: 'in_stock',
        notes: product.notes,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, prodPath);
    }

    // Create new sold record in Firestore so it appears in "Vendidos"
    const soldProdId = `prod_sold_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const soldProdPath = `products/${soldProdId}`;
    const cleanSoldPayload = sanitizeProductPayload(
      {
        name: product.name,
        sku: product.sku,
        category: product.category,
        imageUrl: product.imageUrl,
        entryDate: product.entryDate,
        saleDate,
        unitCost: product.unitCost,
        quantity: 0,
        initialQuantity: unitsToSell,
        soldQuantity: unitsToSell,
        minStock: product.minStock,
        unitSalePrice,
        totalSalePrice: soldBatchTotalSale,
        reinvestedAmount,
        status: 'sold',
        notes: soldRecordNotes,
      },
      user.uid
    );

    try {
      await setDoc(doc(db, 'products', soldProdId), {
        ...cleanSoldPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, soldProdPath);
    }

    const movId = `mov_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const movPath = `movements/${movId}`;
    try {
      await setDoc(doc(db, 'movements', movId), {
        ownerId: user.uid,
        productId: soldProdId,
        productName: product.name.slice(0, 150),
        type: 'sale',
        quantity: unitsToSell,
        unitCost: Math.max(0, product.unitCost),
        unitSalePrice: Math.max(0, unitSalePrice),
        totalAmount: Math.max(0, soldBatchTotalSale),
        profit: unitsToSell * (unitSalePrice - product.unitCost),
        reinvestedAmount: Math.max(0, reinvestedAmount),
        date: saleDate.slice(0, 30),
        notes: soldRecordNotes.slice(0, 300),
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, movPath);
    }

    showNotice(
      `Venta parcial registrada: ${unitsToSell} ud(s) en la pestaña "Vendidos" y quedan ${remainingQty} ud(s) en "En Stock".`
    );
  };

  // Confirm Restock (Action 2 in firestore.rules)
  const handleConfirmRestock = async (
    product: Product,
    addedUnits: number,
    newUnitCost: number,
    markAsReinvested: boolean,
    notes: string
  ) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const nextQty = product.quantity + addedUnits;
    const nextInitQty = isProductSold(product)
      ? addedUnits
      : Math.max(nextQty, product.initialQuantity + addedUnits);
    const restockCost = addedUnits * newUnitCost;
    const nextReinvested = markAsReinvested
      ? (product.reinvestedAmount || 0) + restockCost
      : product.reinvestedAmount || 0;
    const nextTotalSalePrice = product.unitSalePrice * nextInitQty;
    const updatedNotes = notes
      ? `${product.notes ? product.notes + ' · ' : ''}Reabastecimiento (+${addedUnits} uds): ${notes}`.slice(
          0,
          500
        )
      : product.notes;

    if (!user) {
      setLocalProducts((prev) =>
        prev.map((p) =>
          p.id === product.id
            ? {
                ...p,
                entryDate: todayStr,
                saleDate: '',
                unitCost: newUnitCost,
                quantity: nextQty,
                initialQuantity: nextInitQty,
                soldQuantity: 0,
                totalSalePrice: nextTotalSalePrice,
                reinvestedAmount: nextReinvested,
                status: 'in_stock',
                notes: updatedNotes,
              }
            : p
        )
      );
      setLocalMovements((prev) => [
        {
          id: `mov_local_${Date.now()}`,
          ownerId: 'preview_user',
          productId: product.id,
          productName: product.name,
          type: 'restock',
          quantity: addedUnits,
          unitCost: newUnitCost,
          unitSalePrice: product.unitSalePrice,
          totalAmount: restockCost,
          profit: 0,
          reinvestedAmount: markAsReinvested ? restockCost : 0,
          date: todayStr,
          notes: (notes || 'Reabastecimiento de stock').slice(0, 300),
        },
        ...prev,
      ]);
      showNotice(`Stock reabastecido: +${addedUnits} unidades en "${product.name}".`);
      return;
    }

    const prodPath = `products/${product.id}`;
    try {
      await updateDoc(doc(db, 'products', product.id), {
        name: product.name,
        sku: product.sku,
        category: product.category,
        imageUrl: product.imageUrl,
        entryDate: todayStr,
        saleDate: '',
        unitCost: Math.max(0, newUnitCost),
        quantity: nextQty,
        initialQuantity: nextInitQty,
        soldQuantity: 0,
        minStock: product.minStock,
        unitSalePrice: product.unitSalePrice,
        totalSalePrice: Math.max(0, nextTotalSalePrice),
        reinvestedAmount: Math.max(0, nextReinvested),
        status: 'in_stock',
        notes: updatedNotes,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, prodPath);
    }

    const movId = `mov_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const movPath = `movements/${movId}`;
    try {
      await setDoc(doc(db, 'movements', movId), {
        ownerId: user.uid,
        productId: product.id,
        productName: product.name.slice(0, 150),
        type: 'restock',
        quantity: Math.max(0, addedUnits),
        unitCost: Math.max(0, newUnitCost),
        unitSalePrice: Math.max(0, product.unitSalePrice),
        totalAmount: Math.max(0, restockCost),
        profit: 0,
        reinvestedAmount: markAsReinvested ? Math.max(0, restockCost) : 0,
        date: todayStr,
        notes: (notes || 'Reabastecimiento por alerta de stock mínimo').slice(0, 300),
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, movPath);
    }
    showNotice(`Stock reabastecido: +${addedUnits} unidades en "${product.name}".`);
  };

  // Delete Product
  const handleDeleteProduct = async (product: Product) => {
    if (!user) {
      setLocalProducts((prev) => prev.filter((p) => p.id !== product.id));
      return;
    }
    const path = `products/${product.id}`;
    try {
      await deleteDoc(doc(db, 'products', product.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  // Restore original 3 Excel products
  const handleRestoreExcelSeed = async () => {
    if (!user) {
      setLocalProducts(
        INITIAL_EXCEL_PRODUCTS.map((item, idx) => ({
          ...item,
          id: `excel_seed_${idx + 1}_${Date.now()}`,
          ownerId: 'preview_user',
        }))
      );
      return;
    }
    await seedExcelProductsToFirestore(user.uid);
  };

  // Export current sheet to Excel-compatible CSV
  const handleExportExcelCSV = () => {
    const headers = [
      'Fecha',
      'Articulo',
      'SKU',
      'Categoria',
      'Precio Unitario',
      'Cantidad Stock',
      'Stock Minimo',
      'Total',
      'Precio de venta',
      'Utilidad',
      'Fecha de Venta',
      'Dias en Inventario',
      'Dinero reeinvertido',
    ];

    const rows = activeProducts.map((p) => {
      const m = calculateProductMetrics(p);
      const t = calculateInventoryTime(
        p.entryDate,
        p.saleDate,
        p.quantity,
        now,
        p.status
      );
      return [
        formatExcelDate(p.entryDate),
        `"${p.name.replace(/"/g, '""')}"`,
        p.sku,
        `"${p.category}"`,
        p.unitCost,
        p.quantity,
        p.minStock,
        m.totalBatchCost,
        m.totalSalePrice,
        m.totalProfit,
        p.saleDate ? formatExcelDate(p.saleDate) : '',
        t.days,
        p.reinvestedAmount || 0,
      ].join(',');
    });

    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario_stockflow_${now.toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Compute global KPIs & Stock Alerts
  const alertProducts = useMemo(() => {
    return activeProducts.filter((p) => p.quantity <= p.minStock);
  }, [activeProducts]);

  const inStockCount = useMemo(
    () => activeProducts.filter((p) => !isProductSold(p) && p.quantity > 0).length,
    [activeProducts]
  );

  const soldCount = useMemo(
    () => activeProducts.filter((p) => isProductSold(p)).length,
    [activeProducts]
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    activeProducts.forEach((p) => set.add(p.category));
    return Array.from(set);
  }, [activeProducts]);

  const filteredProducts = useMemo(() => {
    return activeProducts
      .filter((p) => {
        const sold = isProductSold(p);
        if (stockFilter === 'in_stock' && (sold || p.quantity <= 0)) return false;
        if (stockFilter === 'low_stock' && p.quantity > p.minStock) return false;
        if (stockFilter === 'sold' && !sold) return false;
        if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'profit') {
          return (
            calculateProductMetrics(b).totalProfit -
            calculateProductMetrics(a).totalProfit
          );
        }
        if (sortBy === 'days') {
          return (
            calculateInventoryTime(
              b.entryDate,
              b.saleDate,
              b.quantity,
              now,
              b.status
            ).days -
            calculateInventoryTime(
              a.entryDate,
              a.saleDate,
              a.quantity,
              now,
              a.status
            ).days
          );
        }
        return b.entryDate.localeCompare(a.entryDate);
      });
  }, [activeProducts, stockFilter, categoryFilter, searchQuery, sortBy, now]);

  const summaryTotals = useMemo(() => {
    return activeProducts.reduce(
      (acc, p) => {
        const m = calculateProductMetrics(p);
        const t = calculateInventoryTime(
          p.entryDate,
          p.saleDate,
          p.quantity,
          now,
          p.status
        );
        acc.totalBatchCost += m.totalBatchCost;
        acc.currentStockValue += m.currentStockCost;
        acc.totalSalePrice += m.totalSalePrice;
        acc.totalProfit += m.totalProfit;
        acc.realizedProfit += m.realizedProfit;
        acc.reinvestedAmount += p.reinvestedAmount || 0;
        acc.totalUnitsInStock += p.quantity;
        acc.totalInitialUnits += p.initialQuantity;
        acc.daysTotal += t.days;
        return acc;
      },
      {
        totalBatchCost: 0,
        currentStockValue: 0,
        totalSalePrice: 0,
        totalProfit: 0,
        realizedProfit: 0,
        reinvestedAmount: 0,
        totalUnitsInStock: 0,
        totalInitialUnits: 0,
        daysTotal: 0,
      }
    );
  }, [activeProducts, now]);

  const avgInventoryDays =
    activeProducts.length > 0
      ? Math.round(summaryTotals.daysTotal / activeProducts.length)
      : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract: strictly 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('inventory');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          StockFlow Pro
        </a>

        {/* Zone 2: 4 Single-line Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              activeTab === 'inventory'
                ? 'text-slate-900 border-b-2 border-slate-900 font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            Hoja de Inventario
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('alerts')}
            className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              activeTab === 'alerts'
                ? 'text-slate-900 border-b-2 border-slate-900 font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            Alertas de Stock ({alertProducts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              activeTab === 'reports'
                ? 'text-slate-900 border-b-2 border-slate-900 font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            Reportes Mensuales
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('movements')}
            className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              activeTab === 'movements'
                ? 'text-slate-900 border-b-2 border-slate-900 font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            Movimientos
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action Button */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => {
              setEditingProduct(null);
              setIsProductModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo Artículo
          </button>
        </div>
      </header>

      {/* Main Workspace Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Sub-header Bar: Real-Time Clock, Cloud Sync Status & Excel Reference Button */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <Clock className="w-4 h-4 text-slate-700 shrink-0" />
            <span className="font-medium text-slate-900">
              Cálculo de Días en Tiempo Real:
            </span>
            <span className="font-mono tabular-nums text-slate-800">
              {now.toLocaleDateString('es-CO', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}{' '}
              · {now.toLocaleTimeString('es-CO')}
            </span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setIsExcelModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-emerald-700 font-medium hover:underline whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Ver comparativa con mi Excel original
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setIsSyncModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-blue-700 font-semibold hover:underline whitespace-nowrap"
            >
              <Smartphone className="w-3.5 h-3.5" />
              Usar en Celular / Otro PC
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Mobile Navigation Switcher */}
            <div className="flex md:hidden items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab('inventory')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                  activeTab === 'inventory'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600'
                }`}
              >
                Inventario
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('alerts')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                  activeTab === 'alerts'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600'
                }`}
              >
                Alertas ({alertProducts.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('reports')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                  activeTab === 'reports'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600'
                }`}
              >
                Reportes
              </button>
            </div>

            {user ? (
              <div className="flex items-center gap-3 text-xs text-slate-600">
                <span className="truncate max-w-[200px]">
                  Sincronizado en la nube: <strong className="text-slate-900">{user.email}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Salir
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">
                  Modo vista previa local (Inicia sesión para guardar en la nube)
                </span>
                <button
                  type="button"
                  onClick={handleSignIn}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Guardar con mi cuenta Google
                </button>
              </div>
            )}
          </div>
        </div>

        {authBannerError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 flex items-center justify-between">
            <span>{authBannerError}</span>
            <button
              type="button"
              onClick={() => setAuthBannerError('')}
              className="underline font-medium"
            >
              Cerrar
            </button>
          </div>
        )}

        {feedbackNotice && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs text-emerald-900 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="font-medium">{feedbackNotice}</span>
            </div>
            <div className="flex items-center gap-3">
              {stockFilter !== 'sold' && (
                <button
                  type="button"
                  onClick={() => setStockFilter('sold')}
                  className="font-semibold text-emerald-800 underline hover:text-emerald-950"
                >
                  Ir a pestaña Vendidos ({soldCount}) →
                </button>
              )}
              <button
                type="button"
                onClick={() => setFeedbackNotice('')}
                className="text-slate-500 hover:text-slate-800"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* 4-Column Financial & Stock KPI Strip */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs font-medium text-slate-500">
              Inversión Total Acumulada (Col E)
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1.5">
              {formatCOP(summaryTotals.totalBatchCost)}
            </div>
            <div className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
              <span>En stock actual:</span>
              <span className="font-mono font-medium text-slate-800">
                {formatCOPCompact(summaryTotals.currentStockValue)}
              </span>
              <span>·</span>
              <span className="font-mono">{summaryTotals.totalUnitsInStock} uds</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs font-medium text-slate-500">
              Precio de Venta Total Lotes (Col F)
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1.5">
              {formatCOP(summaryTotals.totalSalePrice)}
            </div>
            <div className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
              <span>Dinero reinvertido (Col J):</span>
              <span className="font-mono font-medium text-blue-700">
                {formatCOPCompact(summaryTotals.reinvestedAmount)}
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs font-medium text-slate-500">
              Utilidad Neta Total (Col G)
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1.5">
              {formatCOP(summaryTotals.totalProfit)}
            </div>
            <div className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
              <span>Utilidad ya cobrada:</span>
              <span className="font-mono font-semibold text-emerald-700">
                {formatCOPCompact(summaryTotals.realizedProfit)}
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs font-medium text-slate-500">
              Alertas de Stock Mínimo y Rotación
            </div>
            <div className="flex items-baseline justify-between mt-1.5">
              <div
                className={`text-2xl font-bold font-mono tabular-nums ${
                  alertProducts.length > 0 ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                {alertProducts.length}{' '}
                <span className="text-sm font-medium">
                  {alertProducts.length === 1 ? 'alerta activa' : 'alertas activas'}
                </span>
              </div>
              <span className="text-xs font-mono text-slate-500">
                Prom. {avgInventoryDays}d
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1.5">
              {alertProducts.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setActiveTab('alerts')}
                  className="text-amber-800 font-medium hover:underline"
                >
                  Revisar productos para reabastecer →
                </button>
              ) : (
                <span>Todos los productos superan el stock mínimo</span>
              )}
            </div>
          </div>
        </section>

        {/* Automatic Stock Alert Banner when on Inventory view */}
        {activeTab === 'inventory' && alertProducts.length > 0 && (
          <div className="bg-amber-50/90 border border-amber-200 rounded-xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
              <div className="text-xs text-amber-950">
                <span className="font-semibold">
                  Alerta Automática de Reabastecimiento:
                </span>{' '}
                Tienes {alertProducts.length}{' '}
                {alertProducts.length === 1
                  ? 'artículo en o por debajo del stock mínimo'
                  : 'artículos en o por debajo del stock mínimo'}{' '}
                ({alertProducts.map((a) => `${a.name} [${a.quantity}/${a.minStock} uds]`).join(' · ')}
                ).
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('alerts')}
              className="px-3.5 py-1.5 text-xs font-semibold text-amber-950 bg-amber-200/70 hover:bg-amber-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Gestionar Reabastecimiento
            </button>
          </div>
        )}

        {/* TAB 1: MAIN EXCEL INVENTORY SHEET */}
        {activeTab === 'inventory' && (
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {/* Table Filter & Search Bar */}
            <div className="p-4 sm:px-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {/* Interactive Segmented Control */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setStockFilter('all')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      stockFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Todos ({activeProducts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockFilter('in_stock')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      stockFilter === 'in_stock'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    En Stock ({inStockCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockFilter('low_stock')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      stockFilter === 'low_stock'
                        ? 'bg-white text-amber-800 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Stock Bajo / Agotado ({alertProducts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockFilter('sold')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      stockFilter === 'sold'
                        ? 'bg-white text-emerald-800 font-semibold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Vendidos ({soldCount})
                  </button>
                </div>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-slate-900"
                >
                  <option value="ALL">Todas las categorías</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative flex-1 sm:w-60">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar artículo o SKU..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(
                        e.target.value as 'entryDate' | 'profit' | 'days' | 'name'
                      )
                    }
                    className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-slate-900"
                  >
                    <option value="entryDate">Ordenar: Fecha Ingreso</option>
                    <option value="profit">Ordenar: Mayor Utilidad</option>
                    <option value="days">Ordenar: Días en Inventario</option>
                    <option value="name">Ordenar: Nombre A–Z</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleExportExcelCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exportar CSV (Excel)
                </button>
              </div>
            </div>

            {/* Loading Skeleton */}
            {loadingData || seedingInitial ? (
              <div className="p-8 space-y-3">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-14 bg-slate-100 rounded-lg animate-pulse"
                  />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <p className="text-sm font-medium text-slate-800">
                  No se encontraron productos con los filtros seleccionados
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Agrega un nuevo artículo o restaura los 3 productos de tu hoja de Excel original.
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProduct(null);
                      setIsProductModalOpen(true);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
                  >
                    Registrar Primer Artículo
                  </button>
                  <button
                    type="button"
                    onClick={handleRestoreExcelSeed}
                    className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                  >
                    Cargar Datos de Mi Excel
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-600">
                      <th className="py-3 px-3.5 whitespace-nowrap">
                        A · Fecha
                      </th>
                      <th className="py-3 px-4 min-w-[250px]">
                        B · Artículo
                      </th>
                      <th className="py-3 px-3.5 text-right whitespace-nowrap">
                        C · Precio Unitario
                      </th>
                      <th className="py-3 px-3.5 text-center whitespace-nowrap">
                        D · Cantidad / Mín.
                      </th>
                      <th className="py-3 px-3.5 text-right whitespace-nowrap">
                        E · Total
                      </th>
                      <th className="py-3 px-3.5 text-right whitespace-nowrap">
                        F · Precio de venta
                      </th>
                      <th className="py-3 px-3.5 text-right whitespace-nowrap">
                        G · Utilidad
                      </th>
                      <th className="py-3 px-3.5 whitespace-nowrap">
                        H · Fecha de Venta
                      </th>
                      <th className="py-3 px-3.5 whitespace-nowrap">
                        I · Días en Inventario
                      </th>
                      <th className="py-3 px-3.5 text-right whitespace-nowrap">
                        J · Dinero reinvertido
                      </th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {filteredProducts.map((product) => {
                      const sold = isProductSold(product);
                      const metrics = calculateProductMetrics(product);
                      const timeInfo = calculateInventoryTime(
                        product.entryDate,
                        product.saleDate,
                        product.quantity,
                        now,
                        product.status
                      );

                      return (
                        <tr
                          key={product.id}
                          className="hover:bg-slate-50/90 transition-colors group"
                        >
                          {/* Col A: Fecha */}
                          <td className="py-3.5 px-3.5 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                            {formatExcelDate(product.entryDate)}
                          </td>

                          {/* Col B: Artículo (Thumbnail + Name + Quiet Metadata) */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="relative w-12 h-12 rounded-lg border border-slate-200 bg-white flex items-center justify-center shrink-0 overflow-hidden">
                                {product.imageUrl ? (
                                  <img
                                    src={product.imageUrl}
                                    alt={product.name}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-contain"
                                  />
                                ) : (
                                  <span className="text-[10px] font-mono text-slate-400">
                                    IMG
                                  </span>
                                )}
                                <span className="absolute bottom-0.5 right-0.5 bg-white/95 border border-slate-300 text-slate-900 font-mono font-bold text-[10px] px-1 rounded">
                                  {sold ? product.initialQuantity : product.quantity}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-900 text-xs leading-snug line-clamp-2">
                                  {product.name}
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                                  <span className="font-mono">{product.sku}</span>
                                  <span aria-hidden="true">·</span>
                                  <span>{product.category}</span>
                                  <span aria-hidden="true">·</span>
                                  <span
                                    className={
                                      sold
                                        ? 'text-emerald-700 font-medium'
                                        : 'text-slate-600'
                                    }
                                  >
                                    {sold ? 'Vendido' : 'En Stock'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Col C: Precio Unitario */}
                          <td className="py-3.5 px-3.5 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                            {formatCOP(product.unitCost)}
                          </td>

                          {/* Col D: Cantidad & Stock Mínimo Alert */}
                          <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                            {sold ? (
                              <>
                                <div className="font-mono tabular-nums font-semibold text-xs text-emerald-800">
                                  {product.soldQuantity || product.initialQuantity} vendida(s)
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  Stock disp: 0 (Mín: {product.minStock})
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="font-mono tabular-nums font-semibold text-sm text-slate-900">
                                  {product.quantity}{' '}
                                  <span className="text-[11px] font-normal text-slate-400">
                                    / lote {product.initialQuantity}
                                  </span>
                                </div>
                                <div
                                  className={`text-[11px] font-medium mt-0.5 ${
                                    metrics.alertLevel === 'out_of_stock'
                                      ? 'text-red-600'
                                      : metrics.alertLevel === 'low_stock'
                                      ? 'text-amber-700'
                                      : 'text-slate-500'
                                  }`}
                                >
                                  {metrics.alertLevel === 'out_of_stock'
                                    ? `Agotado (Mín: ${product.minStock})`
                                    : metrics.alertLevel === 'low_stock'
                                    ? `Bajo stock (Mín: ${product.minStock})`
                                    : `Mínimo: ${product.minStock} uds`}
                                </div>
                              </>
                            )}
                          </td>

                          {/* Col E: Total */}
                          <td className="py-3.5 px-3.5 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                            {formatCOPCompact(metrics.totalBatchCost)}
                          </td>

                          {/* Col F: Precio de venta */}
                          <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                            <div className="font-mono tabular-nums font-medium text-slate-900">
                              {formatCOP(metrics.totalSalePrice)}
                            </div>
                            {product.initialQuantity > 1 && (
                              <div className="text-[11px] font-mono tabular-nums text-slate-500">
                                {formatCOPCompact(product.unitSalePrice)} c/u
                              </div>
                            )}
                          </td>

                          {/* Col G: Utilidad */}
                          <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                            <div
                              className={`font-mono tabular-nums font-semibold ${
                                metrics.totalProfit > 0
                                  ? 'text-emerald-700'
                                  : metrics.totalProfit < 0
                                  ? 'text-red-600'
                                  : 'text-slate-500'
                              }`}
                            >
                              {metrics.totalProfit === 0
                                ? '$ -'
                                : formatCOP(metrics.totalProfit)}
                            </div>
                            <div className="text-[11px] font-mono tabular-nums text-slate-500">
                              {metrics.totalProfit > 0
                                ? `+${metrics.roiPercent.toFixed(1)}% ROI`
                                : 'Sin margen (0%)'}
                            </div>
                          </td>

                          {/* Col H: Fecha de Venta */}
                          <td className="py-3.5 px-3.5 whitespace-nowrap">
                            {product.saleDate ? (
                              <div>
                                <div className="font-mono tabular-nums text-slate-900 font-semibold">
                                  {formatExcelDate(product.saleDate)}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSaleTargetProduct(product)}
                                  className="text-[11px] text-emerald-700 hover:underline"
                                >
                                  Editar venta
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSaleTargetProduct(product)}
                                className="text-xs text-emerald-700 font-medium hover:underline"
                              >
                                + Registrar fecha venta
                              </button>
                            )}
                          </td>

                          {/* Col I: Días en Inventario (Real-Time) */}
                          <td className="py-3.5 px-3.5 whitespace-nowrap">
                            <div
                              className={`font-mono tabular-nums font-semibold ${
                                timeInfo.agingTier === 'slow'
                                  ? 'text-amber-700'
                                  : timeInfo.agingTier === 'sold'
                                  ? 'text-slate-700'
                                  : 'text-slate-900'
                              }`}
                            >
                              {timeInfo.headline}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {timeInfo.sublabel}
                            </div>
                          </td>

                          {/* Col J: Dinero reinvertido */}
                          <td className="py-3.5 px-3.5 text-right font-mono tabular-nums whitespace-nowrap">
                            {product.reinvestedAmount > 0 ? (
                              <span className="font-medium text-blue-700">
                                {formatCOP(product.reinvestedAmount)}
                              </span>
                            ) : (
                              <span className="text-slate-400">$ -</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              {!sold ? (
                                <button
                                  type="button"
                                  title="Registrar Venta"
                                  onClick={() => setSaleTargetProduct(product)}
                                  className="px-2.5 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors inline-flex items-center gap-1"
                                >
                                  <ShoppingBag className="w-3.5 h-3.5" />
                                  Vender
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  title="Editar datos de la venta"
                                  onClick={() => setSaleTargetProduct(product)}
                                  className="px-2.5 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors inline-flex items-center gap-1"
                                >
                                  <ShoppingBag className="w-3.5 h-3.5" />
                                  Editar Venta
                                </button>
                              )}
                              <button
                                type="button"
                                title="Reabastecer Stock"
                                onClick={() => setRestockTargetProduct(product)}
                                className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center gap-1"
                              >
                                <PackagePlus className="w-3.5 h-3.5" />
                                +Stock
                              </button>
                              <button
                                type="button"
                                title="Editar Registro Completo"
                                onClick={() => {
                                  setEditingProduct(product);
                                  setIsProductModalOpen(true);
                                }}
                                className="px-2 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors inline-flex items-center gap-1"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                Editar
                              </button>
                              <button
                                type="button"
                                title="Eliminar Artículo"
                                onClick={() => handleDeleteProduct(product)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Excel Totals Footer Row */}
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-xs text-slate-900">
                      <td className="py-3.5 px-3.5" colSpan={3}>
                        TOTALES DE LA VISTA ({filteredProducts.length} registros)
                      </td>
                      <td className="py-3.5 px-3.5 text-center font-mono tabular-nums">
                        {summaryTotals.totalUnitsInStock} disp. /{' '}
                        {summaryTotals.totalInitialUnits} lote
                      </td>
                      <td className="py-3.5 px-3.5 text-right font-mono tabular-nums">
                        {formatCOPCompact(summaryTotals.totalBatchCost)}
                      </td>
                      <td className="py-3.5 px-3.5 text-right font-mono tabular-nums">
                        {formatCOP(summaryTotals.totalSalePrice)}
                      </td>
                      <td className="py-3.5 px-3.5 text-right font-mono tabular-nums text-emerald-700">
                        {formatCOP(summaryTotals.totalProfit)}
                      </td>
                      <td className="py-3.5 px-3.5 font-mono text-slate-500">
                        —
                      </td>
                      <td className="py-3.5 px-3.5 font-mono tabular-nums text-slate-700">
                        Prom. {avgInventoryDays} días
                      </td>
                      <td className="py-3.5 px-3.5 text-right font-mono tabular-nums text-blue-700">
                        {summaryTotals.reinvestedAmount > 0
                          ? formatCOP(summaryTotals.reinvestedAmount)
                          : '$ -'}
                      </td>
                      <td className="py-3.5 px-4" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        )}

        {/* TAB 2: AUTOMATIC RESTOCK ALERTS VIEW */}
        {activeTab === 'alerts' && (
          <section className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Centro de Alertas Automáticas de Reabastecimiento
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Monitorea en tiempo real cualquier artículo cuyo stock disponible sea igual o menor a su Stock Mínimo configurado.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('inventory')}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Volver a la Hoja Completa
              </button>
            </div>

            {alertProducts.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Todo tu inventario está por encima del stock mínimo
                </h3>
                <p className="text-xs text-slate-500">
                  Cuando un artículo baje de su umbral mínimo al registrar ventas, aparecerá aquí automáticamente.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                        <th className="py-3 px-4">Artículo</th>
                        <th className="py-3 px-4">Estado de Alerta</th>
                        <th className="py-3 px-4 text-center">Stock Actual / Mínimo</th>
                        <th className="py-3 px-4 text-right">Costo Unitario</th>
                        <th className="py-3 px-4 text-right">Pedido Sugerido</th>
                        <th className="py-3 px-4 text-right">Inversión Estimada</th>
                        <th className="py-3 px-4 text-right">Acción Inmediata</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {alertProducts.map((item) => {
                        const m = calculateProductMetrics(item);
                        return (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="py-4 px-4">
                              <div className="font-semibold text-slate-900">
                                {item.name}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                {item.sku} · {item.category}
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <span
                                className={`font-semibold ${
                                  m.alertLevel === 'out_of_stock'
                                    ? 'text-red-600'
                                    : 'text-amber-700'
                                }`}
                              >
                                {m.alertLabel}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center font-mono tabular-nums font-semibold">
                              {item.quantity} uds / mín. {item.minStock} uds
                            </td>
                            <td className="py-4 px-4 text-right font-mono tabular-nums text-slate-800">
                              {formatCOP(item.unitCost)}
                            </td>
                            <td className="py-4 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                              +{m.suggestedReorderQty} unidades
                            </td>
                            <td className="py-4 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                              {formatCOP(m.estimatedReorderCost)}
                            </td>
                            <td className="py-4 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => setRestockTargetProduct(item)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
                              >
                                <PackagePlus className="w-3.5 h-3.5" />
                                Reabastecer Ahora
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {/* TAB 3: DETAILED MONTHLY REPORTS */}
        {activeTab === 'reports' && (
          <MonthlyReportsView
            products={activeProducts}
            movements={activeMovements}
            now={now}
          />
        )}

        {/* TAB 4: MOVEMENTS & AUDIT LEDGER */}
        {activeTab === 'movements' && (
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Historial de Ventas, Reabastecimientos y Reinversiones
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bitácora cronológica de cada operación registrada sobre tu inventario
                </p>
              </div>
            </div>

            {activeMovements.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">
                Aún no hay movimientos registrados. Usa el botón &ldquo;Vender&rdquo; o &ldquo;+Stock&rdquo; en cualquier artículo para registrar operaciones.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Tipo de Operación</th>
                      <th className="py-3 px-4">Artículo</th>
                      <th className="py-3 px-4 text-right">Cantidad</th>
                      <th className="py-3 px-4 text-right">Monto Total</th>
                      <th className="py-3 px-4 text-right">Utilidad Generada</th>
                      <th className="py-3 px-4 text-right">Dinero Reinvertido</th>
                      <th className="py-3 px-4">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {activeMovements.map((mov) => (
                      <tr key={mov.id} className="hover:bg-slate-50">
                        <td className="py-3.5 px-4 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                          {formatExcelDate(mov.date)}
                        </td>
                        <td className="py-3.5 px-4 font-semibold whitespace-nowrap">
                          {mov.type === 'sale' ? (
                            <span className="text-emerald-700">Venta de Producto</span>
                          ) : mov.type === 'restock' ? (
                            <span className="text-blue-700">Reabastecimiento</span>
                          ) : (
                            <span className="text-slate-700">Ajuste / Reinversión</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-900">
                          {mov.productName}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                          {mov.quantity} uds
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                          {formatCOP(mov.totalAmount)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700">
                          {mov.profit > 0 ? formatCOP(mov.profit) : '$ -'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-blue-700">
                          {mov.reinvestedAmount > 0
                            ? formatCOP(mov.reinvestedAmount)
                            : '$ -'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {mov.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Modals */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => {
          setIsProductModalOpen(false);
          setEditingProduct(null);
        }}
        onSave={handleSaveProduct}
        initialProduct={editingProduct}
      />

      <RecordSaleModal
        product={saleTargetProduct}
        onClose={() => setSaleTargetProduct(null)}
        onConfirmSale={handleConfirmSale}
      />

      <RestockModal
        product={restockTargetProduct}
        onClose={() => setRestockTargetProduct(null)}
        onConfirmRestock={handleConfirmRestock}
      />

      <ExcelComparisonModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onRestoreExcelSeed={handleRestoreExcelSeed}
        restoring={seedingInitial}
      />

      <SyncDevicesModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        user={user}
        onSignIn={handleSignIn}
        onUploadLocalToCloud={async () => {
          if (user) {
            await uploadProductsListToFirestore(user.uid, activeProducts);
            showNotice('Datos sincronizados en la nube correctamente.');
          }
        }}
        uploading={seedingInitial}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <InventoryApp />
    </ErrorBoundary>
  );
}
