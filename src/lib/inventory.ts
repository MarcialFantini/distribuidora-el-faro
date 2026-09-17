import type { Category, Product, StockStatus } from "../data/seed";

// ---------------------------------------------------------------------------
// Status derivation
// ---------------------------------------------------------------------------
// "bajo" fires when stockActual is at or below stockMinimo.
// "critico" fires when stockActual is at or below half of stockMinimo,
// AND stockMinimo > 0. If stockMinimo is 0 the product is treated as
// unmanaged and never alerts.
// ---------------------------------------------------------------------------

export function statusOf(product: Product): StockStatus {
  if (product.stockMinimo <= 0) return "ok";
  if (product.stockActual <= Math.floor(product.stockMinimo / 2))
    return "critico";
  if (product.stockActual <= product.stockMinimo) return "bajo";
  return "ok";
}

export function statusLabel(status: StockStatus): string {
  switch (status) {
    case "ok":
      return "Normal";
    case "bajo":
      return "Bajo stock";
    case "critico":
      return "Crítico";
  }
}

// ---------------------------------------------------------------------------
// Aggregate KPIs used by the dashboard header
// ---------------------------------------------------------------------------

export interface Kpis {
  totalProductos: number;
  totalCategorias: number;
  bajoStockCount: number;
  criticoCount: number;
  bajoStockPct: number;
  valorInventario: number;
}

export function deriveKpis(products: Product[]): Kpis {
  const totalProductos = products.length;
  const cats = new Set<Category>();
  let bajo = 0;
  let critico = 0;
  let valor = 0;
  for (const p of products) {
    cats.add(p.categoria);
    const s = statusOf(p);
    if (s === "bajo") bajo++;
    if (s === "critico") critico++;
    // Mock value: stock * unit price. Demo only.
    valor += p.stockActual * p.precioUnitario;
  }
  const bajoStockPct = totalProductos === 0 ? 0 : (bajo / totalProductos) * 100;
  return {
    totalProductos,
    totalCategorias: cats.size,
    bajoStockCount: bajo,
    criticoCount: critico,
    bajoStockPct,
    valorInventario: valor,
  };
}

// ---------------------------------------------------------------------------
// Currency formatting — ARS, no decimals for inventory value
// ---------------------------------------------------------------------------

const arsFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function formatArs(value: number): string {
  return arsFmt.format(value);
}

const pctFmt = new Intl.NumberFormat("es-AR", {
  style: "percent",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

export function formatPct(fraction: number): string {
  return pctFmt.format(fraction);
}

const numFmt = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 0,
});

export function formatNum(value: number): string {
  return numFmt.format(value);
}

// ---------------------------------------------------------------------------
// Currency input parser — accepts "1.234,56", "1234.56", "1234"
// ---------------------------------------------------------------------------

export function parseArsInput(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function parseStockInput(raw: string): number | null {
  if (raw === "" || raw === null || raw === undefined) return null;
  const cleaned = raw.replace(/\s/g, "");
  if (!/^-?\d+([.,]\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

// ---------------------------------------------------------------------------
// SKU generation: <CAT>-<NAME3>-<SEQ3>
// ---------------------------------------------------------------------------

export function slug3(text: string): string {
  const cleaned = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .trim()
    .split(/\s+/);
  let acc = "";
  for (const w of cleaned) acc += w.slice(0, 3);
  return acc.slice(0, 6).toUpperCase();
}

export function suggestSku(
  nombre: string,
  categoria: Category,
  existing: Product[],
): string {
  const cat = categoria.slice(0, 3).toUpperCase();
  const name = slug3(nombre) || "PRD";
  const prefix = `${cat}-${name}-`;
  let n = 1;
  let candidate = "";
  do {
    candidate = `${prefix}${String(n).padStart(3, "0")}`;
    n++;
    if (n > 999) break;
  } while (existing.some((p) => p.sku === candidate));
  return candidate;
}
