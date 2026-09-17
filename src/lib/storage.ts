import { SEED_PRODUCTS, type Product } from "../data/seed";

// ---------------------------------------------------------------------------
// Persistence layer
//
// This is a DEMO application. There is NO backend. All state lives in
// the browser's localStorage under a single namespaced key.
//
// The shape on disk:
//   {
//     "version": 1,
//     "products": Product[]
//   }
//
// On first load (no key found, or version mismatch), the seed catalog
// is written to storage. The user can clear localStorage at any time
// to reset to the seed state.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "delsur.inventario.v1";
const STORAGE_VERSION = 1;

interface StoredState {
  version: number;
  products: Product[];
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function readState(): StoredState | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredState;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.version !== STORAGE_VERSION) return null;
    if (!Array.isArray(parsed.products)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeState(products: Product[]): void {
  if (!isBrowser()) return;
  const payload: StoredState = {
    version: STORAGE_VERSION,
    products,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota errors, private-mode Safari etc. Silent: the in-memory
    // copy is still the source of truth for the session.
  }
}

export function loadProducts(): Product[] {
  const existing = readState();
  if (existing && existing.products.length > 0) return existing.products;
  // First load or empty: write the seed and return it.
  writeState(SEED_PRODUCTS);
  return SEED_PRODUCTS.slice();
}

export function resetToSeed(): Product[] {
  writeState(SEED_PRODUCTS);
  return SEED_PRODUCTS.slice();
}

// ---------------------------------------------------------------------------
// CRUD helpers — return new array, do not mutate in place.
// ---------------------------------------------------------------------------

export function upsertProduct(
  products: Product[],
  next: Product,
): Product[] {
  const idx = products.findIndex((p) => p.sku === next.sku);
  if (idx === -1) return [...products, next];
  const copy = products.slice();
  copy[idx] = next;
  return copy;
}

export function adjustStock(
  products: Product[],
  sku: string,
  delta: number,
): Product[] {
  const idx = products.findIndex((p) => p.sku === sku);
  if (idx === -1) return products;
  const current = products[idx];
  const nextStock = Math.max(0, current.stockActual + delta);
  const updated: Product = {
    ...current,
    stockActual: nextStock,
    actualizadoEn: new Date().toISOString().slice(0, 10),
  };
  const copy = products.slice();
  copy[idx] = updated;
  return copy;
}

export function setStock(
  products: Product[],
  sku: string,
  newStock: number,
): Product[] {
  const idx = products.findIndex((p) => p.sku === sku);
  if (idx === -1) return products;
  const updated: Product = {
    ...products[idx],
    stockActual: Math.max(0, newStock),
    actualizadoEn: new Date().toISOString().slice(0, 10),
  };
  const copy = products.slice();
  copy[idx] = updated;
  return copy;
}

export function deleteProduct(products: Product[], sku: string): Product[] {
  return products.filter((p) => p.sku !== sku);
}
