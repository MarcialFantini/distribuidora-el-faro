import type { Movimiento, Product, StockStatus } from "../data/seed";

// ---------------------------------------------------------------------------
// Status derivation
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
    case "ok":       return "Normal";
    case "bajo":     return "Bajo stock";
    case "critico":  return "Crítico";
  }
}

// ---------------------------------------------------------------------------
// Aggregate KPIs (dashboard header)
// ---------------------------------------------------------------------------

export interface Kpis {
  totalProductos: number;
  totalCategorias: number;
  bajoStockCount: number;
  criticoCount: number;
  bajoStockPct: number;
  valorInventario: number;
  /** Días sin venta promedio (sobre productos con al menos una salida). */
  diasSinVentaProm: number;
  /** Rotación: ratio salidas/stockActual promedio (últimos 30 días). */
  rotacionPromedio: number;
  /** Valor total de la categoría top. */
  valorTopCategoria: number;
  /** Nombre de la categoría con mayor valor de inventario. */
  topCategoria: string;
}

export function deriveKpis(products: Product[]): Kpis {
  const totalProductos = products.length;
  const cats = new Set<string>();
  let bajo = 0;
  let critico = 0;
  let valor = 0;
  for (const p of products) {
    cats.add(p.categoria);
    const s = statusOf(p);
    if (s === "bajo") bajo++;
    if (s === "critico") critico++;
    valor += p.stockActual * p.precioUnitario;
  }
  const bajoStockPct = totalProductos === 0 ? 0 : (bajo / totalProductos) * 100;
  const diasSinVentaProm = promedioDiasUltimaSalida(products);
  const rotacionPromedio = rotacionPromedio30d(products);
  const { top: topCategoria, valor: valorTopCategoria } = valorPorCategoria(products);
  return {
    totalProductos,
    totalCategorias: cats.size,
    bajoStockCount: bajo,
    criticoCount: critico,
    bajoStockPct,
    valorInventario: valor,
    diasSinVentaProm,
    rotacionPromedio,
    valorTopCategoria,
    topCategoria,
  };
}

// ---------------------------------------------------------------------------
// Currency / number / pct formatting
// ---------------------------------------------------------------------------

const arsFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});
export function formatArs(value: number): string { return arsFmt.format(value); }

const arsFmtDec = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});
export function formatArsDec(value: number): string { return arsFmtDec.format(value); }

const pctFmt = new Intl.NumberFormat("es-AR", {
  style: "percent",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});
export function formatPct(fraction: number): string { return pctFmt.format(fraction); }

const numFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
export function formatNum(value: number): string { return numFmt.format(value); }

const numFmtDec = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});
export function formatNumDec(value: number): string { return numFmtDec.format(value); }

// ---------------------------------------------------------------------------
// Input parsers
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
// SKU generator
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
  categoria: string,
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

// ---------------------------------------------------------------------------
// Stock projection (días de stock restantes, según promedio de salidas)
// ---------------------------------------------------------------------------

export interface ProjectionRow {
  sku: string;
  nombre: string;
  stockActual: number;
  unidad: string;
  ventas30d: number;
  promedioDiario: number;
  diasRestantes: number | null;
  estado: "sin_ventas" | "ok" | "alerta" | "critico";
}

/**
 * Para cada producto calcula las salidas totales en los últimos 30 días y
 * las proyecta contra el stock actual. Si no hay salidas, diasRestantes=null.
 *
 *  - estado="critico" si diasRestantes <= 7
 *  - estado="alerta"  si diasRestantes <= 14
 *  - estado="ok"      en caso contrario
 */
export function projectRotation(products: Product[]): ProjectionRow[] {
  const now = Date.now();
  const cutoff = now - 30 * 24 * 60 * 60 * 1000;
  const out: ProjectionRow[] = [];
  for (const p of products) {
    const ventas30d = (p.movimientos ?? [])
      .filter((m) => m.tipo === "salida" && new Date(m.fecha).getTime() >= cutoff)
      .reduce((acc, m) => acc + Math.abs(m.cantidad), 0);
    const promedioDiario = ventas30d / 30;
    let diasRestantes: number | null = null;
    let estado: ProjectionRow["estado"] = "sin_ventas";
    if (promedioDiario > 0) {
      diasRestantes = p.stockActual / promedioDiario;
      if (diasRestantes <= 7) estado = "critico";
      else if (diasRestantes <= 14) estado = "alerta";
      else estado = "ok";
    }
    out.push({
      sku: p.sku,
      nombre: p.nombre,
      stockActual: p.stockActual,
      unidad: p.unidad,
      ventas30d,
      promedioDiario,
      diasRestantes,
      estado,
    });
  }
  out.sort((a, b) => {
    if (a.diasRestantes === null && b.diasRestantes === null) return 0;
    if (a.diasRestantes === null) return 1;
    if (b.diasRestantes === null) return -1;
    return a.diasRestantes - b.diasRestantes;
  });
  return out;
}

// ---------------------------------------------------------------------------
// Categorías: valor y métricas agregadas
// ---------------------------------------------------------------------------

export interface CategoryMetrics {
  categoria: string;
  productos: number;
  stockTotal: number;
  valor: number;
  /** Productos en estado bajo o crítico dentro de la categoría. */
  bajoCount: number;
  criticoCount: number;
  /** Porcentaje del valor total del inventario. */
  pctValor: number;
}

export function categoryMetrics(
  products: Product[],
): CategoryMetrics[] {
  const total = products.reduce((acc, p) => acc + p.stockActual * p.precioUnitario, 0);
  const map = new Map<string, CategoryMetrics>();
  for (const p of products) {
    const m = map.get(p.categoria) ?? {
      categoria: p.categoria,
      productos: 0,
      stockTotal: 0,
      valor: 0,
      bajoCount: 0,
      criticoCount: 0,
      pctValor: 0,
    };
    m.productos += 1;
    m.stockTotal += p.stockActual;
    m.valor += p.stockActual * p.precioUnitario;
    const s = statusOf(p);
    if (s === "bajo") m.bajoCount++;
    if (s === "critico") m.criticoCount++;
    map.set(p.categoria, m);
  }
  const rows = Array.from(map.values());
  for (const r of rows) r.pctValor = total > 0 ? (r.valor / total) * 100 : 0;
  rows.sort((a, b) => b.valor - a.valor);
  return rows;
}

/** Devuelve la categoría con mayor valor y su valor (helper para KPIs). */
export function valorPorCategoria(products: Product[]): {
  top: string;
  valor: number;
} {
  const rows = categoryMetrics(products);
  if (rows.length === 0) return { top: "—", valor: 0 };
  return { top: rows[0].categoria, valor: rows[0].valor };
}

// ---------------------------------------------------------------------------
// Top movers (productos con más movimientos en los últimos 30 días)
// ---------------------------------------------------------------------------

export interface MoverRow {
  sku: string;
  nombre: string;
  categoria: string;
  totalMovimientos: number;
  ventas30d: number;
  entradas30d: number;
  unidad: string;
}

export function topMovers(products: Product[], limit = 5): MoverRow[] {
  const now = Date.now();
  const cutoff = now - 30 * 24 * 60 * 60 * 1000;
  const rows: MoverRow[] = products.map((p) => {
    const ms = p.movimientos ?? [];
    const recientes = ms.filter((m) => new Date(m.fecha).getTime() >= cutoff);
    const ventas30d = recientes
      .filter((m) => m.tipo === "salida")
      .reduce((acc, m) => acc + Math.abs(m.cantidad), 0);
    const entradas30d = recientes
      .filter((m) => m.tipo === "entrada")
      .reduce((acc, m) => acc + Math.abs(m.cantidad), 0);
    return {
      sku: p.sku,
      nombre: p.nombre,
      categoria: p.categoria,
      totalMovimientos: recientes.length,
      ventas30d,
      entradas30d,
      unidad: p.unidad,
    };
  });
  rows.sort((a, b) => b.totalMovimientos - a.totalMovimientos);
  return rows.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Movimientos diarios últimos N días (serie para gráfico)
// ---------------------------------------------------------------------------

export interface DayBucket {
  /** YYYY-MM-DD */
  fecha: string;
  entradas: number;
  salidas: number;
}

export function movimientosPorDia(
  products: Product[],
  days = 30,
): DayBucket[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = now.getTime() - (days - 1) * 24 * 60 * 60 * 1000;
  const buckets: DayBucket[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start + i * 24 * 60 * 60 * 1000);
    const iso = d.toISOString().slice(0, 10);
    buckets.push({ fecha: iso, entradas: 0, salidas: 0 });
  }
  for (const p of products) {
    for (const m of p.movimientos ?? []) {
      const t = new Date(m.fecha).getTime();
      if (t < start) continue;
      const iso = new Date(t).toISOString().slice(0, 10);
      const bucket = buckets.find((b) => b.fecha === iso);
      if (!bucket) continue;
      if (m.tipo === "entrada") bucket.entradas += Math.abs(m.cantidad);
      else if (m.tipo === "salida") bucket.salidas += Math.abs(m.cantidad);
    }
  }
  return buckets;
}

// ---------------------------------------------------------------------------
// Stock evolution por mes para un producto (mini chart detalle)
// ---------------------------------------------------------------------------

export interface MonthBucket {
  /** YYYY-MM */
  mes: string;
  stockTeorico: number;
  entradas: number;
  salidas: number;
}

export function stockEvolutionByMonth(
  product: Product,
  months = 6,
): MonthBucket[] {
  const out: MonthBucket[] = [];
  const now = new Date();
  now.setDate(1);
  now.setHours(0, 0, 0, 0);
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ mes, stockTeorico: 0, entradas: 0, salidas: 0 });
  }
  // Para reconstruir el stock al final de cada mes: partimos del stockActual
  // y vamos restando los delta posteriores a cada mes.
  let running = product.stockActual;
  for (let i = out.length - 1; i >= 0; i--) {
    const bucket = out[i];
    let deltaDespues = 0;
    let entradasMes = 0;
    let salidasMes = 0;
    for (const m of product.movimientos ?? []) {
      const d = new Date(m.fecha);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (mKey === bucket.mes) {
        if (m.tipo === "entrada") entradasMes += Math.abs(m.cantidad);
        else if (m.tipo === "salida") salidasMes += Math.abs(m.cantidad);
        else deltaDespues += m.cantidad;
      } else if (d > new Date(`${bucket.mes}-28T23:59:59.999Z`)) {
        deltaDespues += m.cantidad;
      }
    }
    bucket.entradas = entradasMes;
    bucket.salidas = salidasMes;
    running -= deltaDespues;
    bucket.stockTeorico = running;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Promedio de días desde la última salida (sobre productos con ventas)
// ---------------------------------------------------------------------------

export function promedioDiasUltimaSalida(products: Product[]): number {
  const now = Date.now();
  let acc = 0;
  let count = 0;
  for (const p of products) {
    const salidas = (p.movimientos ?? []).filter((m) => m.tipo === "salida");
    if (salidas.length === 0) continue;
    const last = salidas.reduce((max, m) => (m.fecha > max ? m.fecha : max), salidas[0].fecha);
    acc += (now - new Date(last).getTime()) / (24 * 60 * 60 * 1000);
    count++;
  }
  return count === 0 ? 0 : acc / count;
}

// ---------------------------------------------------------------------------
// Rotación promedio últimos 30 días (ratio salidas / stockActual)
// ---------------------------------------------------------------------------

export function rotacionPromedio30d(products: Product[]): number {
  const now = Date.now();
  const cutoff = now - 30 * 24 * 60 * 60 * 1000;
  let totalSalidas = 0;
  let totalStock = 0;
  for (const p of products) {
    totalStock += p.stockActual;
    const salidas30 = (p.movimientos ?? [])
      .filter((m) => m.tipo === "salida" && new Date(m.fecha).getTime() >= cutoff)
      .reduce((acc, m) => acc + Math.abs(m.cantidad), 0);
    totalSalidas += salidas30;
  }
  return totalStock === 0 ? 0 : totalSalidas / totalStock;
}

// ---------------------------------------------------------------------------
// Listado plano de todos los movimientos con su producto (para /movimientos)
// ---------------------------------------------------------------------------

export interface MovementWithProduct extends Movimiento {
  sku: string;
  nombre: string;
  categoria: string;
  unidad: string;
}

export function flattenMovements(products: Product[]): MovementWithProduct[] {
  const out: MovementWithProduct[] = [];
  for (const p of products) {
    for (const m of p.movimientos ?? []) {
      out.push({
        ...m,
        sku: p.sku,
        nombre: p.nombre,
        categoria: p.categoria,
        unidad: p.unidad,
      });
    }
  }
  out.sort((a, b) => b.fecha.localeCompare(a.fecha));
  return out;
}
