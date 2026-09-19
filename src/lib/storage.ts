import {
  SEED_AUDIT,
  SEED_OPERARIOS,
  SEED_ORDENES,
  SEED_PRODUCTS_WITH_MOVS,
  SEED_PROVEEDORES,
  type AuditEntry,
  type Movimiento,
  type MovementType,
  type Operario,
  type OrdenCompra,
  type Product,
  type Proveedor,
} from "../data/seed";

// ---------------------------------------------------------------------------
// Persistence layer (DEMO, sin backend).
// Single namespaced localStorage key con esquema versionado.
//
// Shape v3 (actual):
//   {
//     version: 3,
//     products: Product[] (con movimientos)
//     proveedores: Proveedor[]
//     operarios: Operario[]
//     ordenes: OrdenCompra[]
//     audit: AuditEntry[]
//     activeOperarioId: string | null
//   }
//
// Migración:
//   - v1 → v3: solo trae products, sembramos el resto.
//   - v2 → v3: shape idéntico (mismo cliente ficticio "Distribuidora El Faro"),
//              solo se actualiza la version key para indicar el rename.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "elfaro.inventario.v3";
const STORAGE_VERSION = 3;

interface StoredStateV1 {
  version: 1;
  products: Product[];
}

interface StoredStateV2 {
  version: 2;
  products: Product[];
  proveedores: Proveedor[];
  operarios: Operario[];
  ordenes: OrdenCompra[];
  audit: AuditEntry[];
  activeOperarioId: string | null;
}

interface StoredState {
  version: 3;
  products: Product[];
  proveedores: Proveedor[];
  operarios: Operario[];
  ordenes: OrdenCompra[];
  audit: AuditEntry[];
  activeOperarioId: string | null;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function defaultState(): StoredState {
  return {
    version: STORAGE_VERSION,
    products: SEED_PRODUCTS_WITH_MOVS,
    proveedores: SEED_PROVEEDORES,
    operarios: SEED_OPERARIOS,
    ordenes: SEED_ORDENES,
    audit: SEED_AUDIT,
    activeOperarioId: SEED_OPERARIOS[0]?.id ?? null,
  };
}

function migrate(raw: string): StoredState | null {
  try {
    const parsed = JSON.parse(raw) as { version?: number };
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.version === 3) {
      return parsed as StoredState;
    }
    if (parsed.version === 2) {
      // v2 → v3: shape idéntico, solo bump de version key.
      // (rename Distribuidora del Sur → Distribuidora El Faro, sin cambios de shape)
      return { ...(parsed as StoredStateV2), version: 3 };
    }
    if (parsed.version === 1) {
      // v1 → v3: solo trae products, sembramos el resto.
      const v1 = parsed as StoredStateV1;
      return {
        version: 3,
        products: v1.products ?? [],
        proveedores: SEED_PROVEEDORES,
        operarios: SEED_OPERARIOS,
        ordenes: SEED_ORDENES,
        audit: SEED_AUDIT,
        activeOperarioId: SEED_OPERARIOS[0]?.id ?? null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function readRaw(): StoredState | null {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  return migrate(raw);
}

export function readState(): StoredState | null {
  return readRaw();
}

export function writeState(state: StoredState): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota / private mode.
  }
}

// ---------------------------------------------------------------------------
// Bootstrap: si no hay estado, escribir el seed.
// ---------------------------------------------------------------------------

export function loadInitial(): StoredState {
  const existing = readRaw();
  if (existing) return existing;
  const seed = defaultState();
  writeState(seed);
  return seed;
}

// ---------------------------------------------------------------------------
// Convenience accessors (devuelven copias seguras)
// ---------------------------------------------------------------------------

export function loadProducts(): Product[] {
  return loadInitial().products.slice();
}

export function loadProveedores(): Proveedor[] {
  return loadInitial().proveedores.slice();
}

export function loadOperarios(): Operario[] {
  return loadInitial().operarios.slice();
}

export function loadOrdenes(): OrdenCompra[] {
  return loadInitial().ordenes.slice();
}

export function loadAudit(): AuditEntry[] {
  return loadInitial().audit.slice();
}

export function loadActiveOperarioId(): string | null {
  return loadInitial().activeOperarioId;
}

// ---------------------------------------------------------------------------
// Mutators: reciben y devuelven el estado completo actualizado.
// Cada uno persiste el resultado automáticamente.
// ---------------------------------------------------------------------------

export function replaceProducts(products: Product[]): void {
  const s = loadInitial();
  writeState({ ...s, products });
}

export function replaceAll(state: Partial<StoredState>): void {
  const s = loadInitial();
  writeState({ ...s, ...state });
}

export function resetToSeed(): StoredState {
  const seed = defaultState();
  writeState(seed);
  return seed;
}

// ---------------------------------------------------------------------------
// CRUD helpers sobre products (compatibilidad con código previo)
// ---------------------------------------------------------------------------

export function upsertProduct(products: Product[], next: Product): Product[] {
  const idx = products.findIndex((p) => p.sku === next.sku);
  if (idx === -1) return [...products, next];
  const copy = products.slice();
  copy[idx] = next;
  return copy;
}

export function deleteProduct(products: Product[], sku: string): Product[] {
  return products.filter((p) => p.sku !== sku);
}

// ---------------------------------------------------------------------------
// Movimientos helpers
// ---------------------------------------------------------------------------

function nowIso(): string {
  return new Date().toISOString();
}

export function movimientosOf(product: Product): Movimiento[] {
  return product.movimientos ?? [];
}

function appendMovement(product: Product, movement: Movimiento | null): Product {
  if (!movement) return product;
  const prev = movimientosOf(product);
  return { ...product, movimientos: [...prev, movement] };
}

export function buildMovement(
  delta: number,
  tipo: MovementType,
  motivo: string,
  usuario: string,
): Movimiento | null {
  if (delta === 0) return null;
  return { fecha: nowIso(), tipo, cantidad: delta, motivo, usuario };
}

export function adjustStock(
  products: Product[],
  sku: string,
  delta: number,
  usuario: string,
): Product[] {
  const idx = products.findIndex((p) => p.sku === sku);
  if (idx === -1) return products;
  const current = products[idx];
  const nextStock = Math.max(0, current.stockActual + delta);
  const effectiveDelta = nextStock - current.stockActual;
  if (effectiveDelta === 0) return products;
  const tipo: MovementType = effectiveDelta > 0 ? "entrada" : "salida";
  const movement = buildMovement(effectiveDelta, tipo, "Ajuste manual", usuario);
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

export function setStock(
  products: Product[],
  sku: string,
  newStock: number,
  usuario: string,
): Product[] {
  const idx = products.findIndex((p) => p.sku === sku);
  if (idx === -1) return products;
  const current = products[idx];
  const safeStock = Math.max(0, newStock);
  const delta = safeStock - current.stockActual;
  const movement =
    delta === 0
      ? null
      : buildMovement(delta, "ajuste", "Edición manual", usuario);
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

// ---------------------------------------------------------------------------
// Audit helpers
// ---------------------------------------------------------------------------

/**
 * Deriva el próximo ID de auditoría desde el array actual de entradas.
 * Es puro y no mantiene estado entre llamadas — el ID se calcula a partir
 * del máximo numérico presente en los IDs existentes. La semilla 1000
 * preserva la compatibilidad con el contador módulo-level anterior.
 */
export function nextAuditId(existing: readonly AuditEntry[]): string {
  const max = existing.reduce((m, e) => {
    const n = parseInt(e.id.replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 1000);
  return `a-${max + 1}`;
}

export function appendAudit(
  state: StoredState,
  entry: Omit<AuditEntry, "id" | "fecha"> & { fecha?: string },
): StoredState {
  const e: AuditEntry = {
    id: nextAuditId(state.audit),
    fecha: entry.fecha ?? nowIso(),
    operario: entry.operario,
    accion: entry.accion,
    detalle: entry.detalle,
    sku: entry.sku,
  };
  return { ...state, audit: [e, ...state.audit] };
}

// ---------------------------------------------------------------------------
// Órdenes helpers
// ---------------------------------------------------------------------------

export function appendOrden(
  state: StoredState,
  orden: OrdenCompra,
): StoredState {
  return { ...state, ordenes: [orden, ...state.ordenes] };
}

export function updateOrden(
  state: StoredState,
  id: string,
  patch: Partial<OrdenCompra>,
): StoredState {
  return {
    ...state,
    ordenes: state.ordenes.map((o) => (o.id === id ? { ...o, ...patch } : o)),
  };
}