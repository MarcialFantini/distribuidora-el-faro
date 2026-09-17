import {
  SEED_PRODUCTS,
  type Movimiento,
  type MovementType,
  type Product,
} from "../data/seed";

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
//
// Schema note: `Product.movimientos` is OPTIONAL. Products persisted
// before this field existed load fine — helpers default it to `[]`.
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
// Helpers
// ---------------------------------------------------------------------------

/**
 * Devuelve el historial del producto garantizando un array (nunca undefined).
 * Útil para iterar sin optional chaining en cada call site.
 */
export function movimientosOf(product: Product): Movimiento[] {
  return product.movimientos ?? [];
}

/**
 * Devuelve el último ID/fecha de movimiento como string, para comparaciones
 * de "actualizadoEn" cuando el producto no registra movimientos manuales.
 */
function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Crea un movimiento con timestamp actual, usuario por defecto "Operario"
 * y motivo opcional. Si el delta es 0, devuelve null (no se registra).
 */
function buildMovement(
  delta: number,
  tipo: MovementType,
  motivo: string,
): Movimiento | null {
  if (delta === 0) return null;
  return {
    fecha: nowIso(),
    tipo,
    cantidad: delta,
    motivo,
    usuario: "Operario",
  };
}

/**
 * Appends a movement to a product, returning a NEW product object.
 * If `movement` is null, returns the original reference unchanged.
 */
function appendMovement(product: Product, movement: Movimiento | null): Product {
  if (!movement) return product;
  const prev = movimientosOf(product);
  return { ...product, movimientos: [...prev, movement] };
}

// ---------------------------------------------------------------------------
// CRUD helpers — return new array, do not mutate in place.
//
// setStock / adjustStock ahora registran un movimiento automático en el
// historial del producto. La motivación por defecto refleja la causa
// operativa del cambio.
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

/**
 * Registra un movimiento manual sin alterar el stock.
 * Útil para anotar conteos o mermas sin tocar el inventario.
 * Si el producto no existe, no hace nada.
 */
export function addMovement(
  products: Product[],
  sku: string,
  movement: Omit<Movimiento, "fecha" | "usuario"> & { usuario?: string },
): Product[] {
  const idx = products.findIndex((p) => p.sku === sku);
  if (idx === -1) return products;
  const full: Movimiento = {
    fecha: nowIso(),
    tipo: movement.tipo,
    cantidad: movement.cantidad,
    motivo: movement.motivo,
    usuario: movement.usuario ?? "Operario",
  };
  const copy = products.slice();
  copy[idx] = appendMovement(products[idx], full);
  return copy;
}

/**
 * +/- stock desde la grilla. delta>0 → entrada; delta<0 → salida.
 * Registra automáticamente el movimiento. Si el delta efectivo es 0
 * (p. ej. -1 sobre stock=0), no se registra movimiento ni se modifica
 * el producto.
 */
export function adjustStock(
  products: Product[],
  sku: string,
  delta: number,
): Product[] {
  const idx = products.findIndex((p) => p.sku === sku);
  if (idx === -1) return products;
  const current = products[idx];
  const nextStock = Math.max(0, current.stockActual + delta);
  const effectiveDelta = nextStock - current.stockActual;
  if (effectiveDelta === 0) return products;
  const tipo: MovementType = effectiveDelta > 0 ? "entrada" : "salida";
  const motivo = "Ajuste manual";
  const movement = buildMovement(effectiveDelta, tipo, motivo);
  const baseUpdated: Product = {
    ...current,
    stockActual: nextStock,
    actualizadoEn: new Date().toISOString().slice(0, 10),
  };
  const updated = appendMovement(baseUpdated, movement);
  const copy = products.slice();
  copy[idx] = updated;
  return copy;
}

/**
 * Setea el stock a un valor exacto. Registra un movimiento tipo "ajuste"
 * con la diferencia entre el stock previo y el nuevo.
 * Si el valor no cambia, no se registra movimiento.
 */
export function setStock(
  products: Product[],
  sku: string,
  newStock: number,
): Product[] {
  const idx = products.findIndex((p) => p.sku === sku);
  if (idx === -1) return products;
  const current = products[idx];
  const safeStock = Math.max(0, newStock);
  const delta = safeStock - current.stockActual;
  const movement = delta === 0 ? null : buildMovement(delta, "ajuste", "Edición manual");
  const baseUpdated: Product = {
    ...current,
    stockActual: safeStock,
    actualizadoEn: new Date().toISOString().slice(0, 10),
  };
  const updated = appendMovement(baseUpdated, movement);
  const copy = products.slice();
  copy[idx] = updated;
  return copy;
}

export function deleteProduct(products: Product[], sku: string): Product[] {
  return products.filter((p) => p.sku !== sku);
}
