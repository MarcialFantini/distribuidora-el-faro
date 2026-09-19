import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowClockwise,
  ArrowsDownUp,
  CaretDown,
  CircleNotch,
  ClockCounterClockwise,
  Coins,
  Drop,
  FileCsv,
  Package,
  PencilSimple,
  Plus,
  Timer,
  TrashSimple,
  TrendUp,
  Warning,
  X,
} from "@phosphor-icons/react";
import {
  SEED_PRODUCTS,
  type Category,
  type Product,
} from "../data/seed";
import {
  categoryMetrics,
  deriveKpis,
  formatArs,
  formatNum,
  formatNumDec,
  formatPct,
  movimientosPorDia,
  statusOf,
  topMovers,
  type Kpis,
} from "../lib/inventory";
import {
  adjustStock,
  appendAudit,
  deleteProduct,
  loadInitial,
  loadProducts,
  replaceAll,
  resetToSeed,
  setStock,
} from "../lib/storage";
import AlertsBanner from "./AlertsBanner";
import CSVImporter from "./CSVImporter";
import MovementHistory from "./MovementHistory";
import StatusBadge from "./StatusBadge";
import MovementsMiniChart from "./MovementsMiniChart";
import { useOperario } from "./OperarioContext";

// Dashboard island — vista principal con KPIs densos, mini chart y top productos.

function stockBarPct(stockActual: number, stockMinimo: number): number {
  if (stockMinimo <= 0) return 100;
  if (stockActual <= 0) return 0;
  return Math.min(100, (stockActual / stockMinimo) * 100);
}

const CATEGORY_OPTIONS: { value: Category | "Todas"; label: string }[] = [
  { value: "Todas", label: "Todas las categorías" },
  { value: "Arroz", label: "Arroz" },
  { value: "Fideos", label: "Fideos" },
  { value: "Aceite", label: "Aceite" },
  { value: "Legumbres", label: "Legumbres" },
  { value: "Conservas", label: "Conservas" },
  { value: "Condimentos", label: "Condimentos" },
  { value: "Snacks", label: "Snacks" },
  { value: "Bebidas", label: "Bebidas" },
  { value: "Lácteos", label: "Lácteos" },
];

const STATUS_OPTIONS: { value: "todos" | "ok" | "bajo" | "critico"; label: string }[] = [
  { value: "todos", label: "Todos los estados" },
  { value: "ok", label: "Normal" },
  { value: "bajo", label: "Bajo stock" },
  { value: "critico", label: "Crítico" },
];

type SortKey = "nombre" | "categoria" | "stockActual" | "estado" | "actualizadoEn";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 14;

export default function Dashboard() {
  const { active } = useOperario();
  const [hydrated, setHydrated] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categoria, setCategoria] = useState<Category | "Todas">("Todas");
  const [estado, setEstado] = useState<"todos" | "ok" | "bajo" | "critico">("todos");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("estado");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [setStockTarget, setSetStockTarget] = useState<Product | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    setProducts(loadProducts());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    function read() {
      const params = new URLSearchParams(window.location.search);
      setQuery(params.get("q") ?? "");
    }
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [hydrated]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (categoria !== "Todas" && p.categoria !== categoria) return false;
      if (estado !== "todos" && statusOf(p) !== estado) return false;
      if (!q) return true;
      return (
        p.sku.toLowerCase().includes(q) ||
        p.nombre.toLowerCase().includes(q) ||
        p.categoria.toLowerCase().includes(q)
      );
    });
  }, [products, categoria, estado, query]);

  const sorted = useMemo(() => {
    const arr = filtered.slice();
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "nombre": cmp = a.nombre.localeCompare(b.nombre, "es"); break;
        case "categoria": cmp = a.categoria.localeCompare(b.categoria, "es"); break;
        case "stockActual": cmp = a.stockActual - b.stockActual; break;
        case "estado": {
          const order = { critico: 0, bajo: 1, ok: 2 } as const;
          cmp = order[statusOf(a)] - order[statusOf(b)];
          break;
        }
        case "actualizadoEn": cmp = a.actualizadoEn.localeCompare(b.actualizadoEn); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  useEffect(() => { setPage(0); }, [categoria, estado, query]);

  const kpis: Kpis = useMemo(() => deriveKpis(products), [products]);
  const miniData = useMemo(() => movimientosPorDia(products, 30), [products]);
  const movers = useMemo(() => topMovers(products, 5), [products]);
  const categoriasTop = useMemo(() => categoryMetrics(products).slice(0, 3), [products]);

function onAdjust(sku: string, delta: number) {
    if (!active) return;
    const target = products.find((p) => p.sku === sku);
    setProducts((arr) => {
      const next = adjustStock(arr, sku, delta, active.nombre);
      flash(
        delta > 0
          ? `Sumaste ${delta} ${target?.unidad ?? ""}`
          : `Restaste ${Math.abs(delta)} ${target?.unidad ?? ""}`,
      );
      return next;
    });
    const cur = loadInitial();
    const nextProducts = adjustStock(cur.products, sku, delta, active.nombre);
    const updated = appendAudit({ ...cur, products: nextProducts }, {
      operario: active.nombre,
      accion: "stock_adjust",
      detalle: `${delta > 0 ? "Sumó" : "Restó"} ${Math.abs(delta)} ${target?.unidad ?? ""} de ${target?.nombre ?? sku} (${sku})`,
      sku,
    });
    replaceAll({ products: nextProducts, audit: updated.audit });
  }

  function onSetStock(sku: string, value: number) {
    if (!active) return;
    const target = products.find((p) => p.sku === sku);
    setProducts((arr) => setStock(arr, sku, value, active.nombre));
    const cur = loadInitial();
    const nextProducts = setStock(cur.products, sku, value, active.nombre);
    const updated = appendAudit({ ...cur, products: nextProducts }, {
      operario: active.nombre,
      accion: "stock_set",
      detalle: `Fijó stock de ${target?.nombre ?? sku} (${sku}) en ${value} ${target?.unidad ?? ""}`,
      sku,
    });
    replaceAll({ products: nextProducts, audit: updated.audit });
    flash(`Stock fijado en ${value}`);
  }

  function openSetStockModal(p: Product) {
    setSetStockTarget(p);
  }

  function applySetStock(value: number) {
    if (!setStockTarget) return;
    if (!Number.isFinite(value) || value < 0) {
      flash("Stock inválido");
      return;
    }
    onSetStock(setStockTarget.sku, Math.floor(value));
    setSetStockTarget(null);
  }

  function onDelete(sku: string) {
    if (!active) return;
    const target = products.find((p) => p.sku === sku);
    setProducts((arr) => deleteProduct(arr, sku));
    const cur = loadInitial();
    const nextProducts = cur.products.filter((p) => p.sku !== sku);
    const updated = appendAudit({ ...cur, products: nextProducts }, {
      operario: active.nombre,
      accion: "eliminacion_producto",
      detalle: `Eliminó producto ${target?.nombre ?? sku} (${sku})`,
      sku,
    });
    replaceAll({ products: nextProducts, audit: updated.audit });
    flash(`Eliminado ${target?.nombre ?? sku}`);
  }

  function onReset() {
    const seeded = resetToSeed();
    setProducts(seeded.products);
    setConfirmReset(false);
    const cur = loadInitial();
    const updated = appendAudit({ ...cur, products: seeded.products, audit: seeded.audit }, {
      operario: active?.nombre ?? "Sistema",
      accion: "stock_reset",
      detalle: `Restableció el catálogo al estado seed (${seeded.products.length} productos)`,
    });
    replaceAll({ products: seeded.products, audit: updated.audit });
    flash("Catálogo restablecido");
  }

  function onCsvImport(rows: Product[]) {
    setProducts((arr) => {
      const map = new Map(arr.map((p) => [p.sku, p]));
      for (const r of rows) map.set(r.sku, r);
      return Array.from(map.values());
    });
    if (active) {
      const cur = loadInitial();
      const map = new Map(cur.products.map((p) => [p.sku, p]));
      for (const r of rows) map.set(r.sku, r);
      const merged = Array.from(map.values());
      const updated = appendAudit({ ...cur, products: merged }, {
        operario: active.nombre,
        accion: "importacion_csv",
        detalle: `Importó ${rows.length} productos desde CSV`,
      });
      replaceAll({ products: merged, audit: updated.audit });
    }
    setCsvOpen(false);
    flash(`${rows.length} productos importados`);
  }

  if (!hydrated) {
    return (
      <div className="grid place-items-center py-20 text-[var(--color-ink-500)]">
        <CircleNotch size={20} weight="bold" className="animate-spin" aria-hidden="true" />
      </div>
    );
  }

  const totalEntradas30 = miniData.reduce((acc, d) => acc + d.entradas, 0);
  const totalSalidas30 = miniData.reduce((acc, d) => acc + d.salidas, 0);

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Resumen operativo" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="eyebrow">Distribuidora El Faro</p>
            <h1 className="mt-1 text-[20px] font-semibold tracking-tight">Panel de inventario</h1>
            <p className="text-[12px] text-[var(--color-ink-500)]">
              {products.length} SKUs · {kpis.totalCategorias} categorías · datos en este navegador
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCsvOpen(true)}
              className="btn-base h-9 border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-[12.5px] hover:bg-[var(--color-surface-muted)]"
            >
              <FileCsv size={14} weight="bold" aria-hidden="true" />
              Importar CSV
            </button>
            <a
              href="/producto/nuevo"
              className="btn-base h-9 bg-[var(--color-ocean)] px-3 text-[12.5px] font-medium text-white hover:bg-[var(--color-ocean-deep)]"
            >
              <Plus size={14} weight="bold" aria-hidden="true" />
              Nuevo producto
            </a>
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="btn-base h-9 border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-[12.5px] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)]"
              aria-label="Restablecer catálogo al estado inicial"
            >
              <ArrowClockwise size={14} weight="bold" aria-hidden="true" />
              Restablecer
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          <KpiCard label="Productos" value={formatNum(kpis.totalProductos)} icon={<Package size={12} weight="bold" aria-hidden="true" />} tone="ink" />
          <KpiCard label="Categorías" value={formatNum(kpis.totalCategorias)} icon={<Package size={12} weight="bold" aria-hidden="true" />} tone="ink" />
          <KpiCard label="Bajo stock" value={formatNum(kpis.bajoStockCount)} hint={`${formatPct(kpis.bajoStockPct / 100)} del total`} icon={<Warning size={12} weight="bold" aria-hidden="true" />} tone="warn" />
          <KpiCard label="Críticos" value={formatNum(kpis.criticoCount)} icon={<Warning size={12} weight="bold" aria-hidden="true" />} tone="bad" />
          <KpiCard label="Valor inventario" value={formatArs(kpis.valorInventario)} icon={<Coins size={12} weight="bold" aria-hidden="true" />} tone="ink" />
          <KpiCard label="Rotación 30d" value={`${formatNumDec(kpis.rotacionPromedio * 100)}%`} hint="salidas / stock" icon={<TrendUp size={12} weight="bold" aria-hidden="true" />} tone="ocean" />
          <KpiCard label="Días sin venta" value={formatNumDec(kpis.diasSinVentaProm)} hint="promedio" icon={<Timer size={12} weight="bold" aria-hidden="true" />} tone="ink" />
          <KpiCard label="Top categoría" value={kpis.topCategoria} hint={formatArs(kpis.valorTopCategoria)} icon={<Drop size={12} weight="bold" aria-hidden="true" />} tone="ocean" />
        </div>
      </section>

      <AlertsBanner
        products={products}
        onSelectProduct={(sku) => {
          const p = products.find((x) => x.sku === sku);
          if (p) setHistoryProduct(p);
        }}
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] lg:col-span-2">
          <header className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-2.5">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold">
              <ArrowsDownUp size={14} weight="bold" aria-hidden="true" className="text-[var(--color-ocean)]" />
              Movimientos · últimos 30 días
            </h2>
            <p className="mono text-[11px] text-[var(--color-ink-500)]">
              +{formatNum(totalEntradas30)} entradas · −{formatNum(totalSalidas30)} salidas
            </p>
          </header>
          <div className="px-3 pb-3 pt-2">
            <MovementsMiniChart data={miniData} />
          </div>
        </section>

        <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)]">
          <header className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-2.5">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold">
              <TrendUp size={14} weight="bold" aria-hidden="true" className="text-[var(--color-ocean)]" />
              Top 5 más movidos
            </h2>
            <p className="mono text-[11px] text-[var(--color-ink-500)]">últimos 30 días</p>
          </header>
          <ol className="divide-y divide-[var(--color-line)]">
            {movers.map((m, i) => (
              <li key={m.sku} className="flex items-center gap-3 px-4 py-2 text-[12.5px]">
                <span className="mono grid h-5 w-5 place-items-center rounded-sm bg-[var(--color-ocean-soft)] text-[var(--color-ocean)]">
                  {i + 1}
                </span>
                <a href={`/producto/${encodeURIComponent(m.sku)}`} className="min-w-0 flex-1 truncate hover:text-[var(--color-ocean)]">
                  {m.nombre}
                </a>
                <span className="mono text-[10.5px] text-[var(--color-ink-500)]">{m.totalMovimientos} mov</span>
                <span className="mono text-[10.5px] text-[var(--color-status-ok)]">+{formatNum(m.entradas30d)}</span>
                <span className="mono text-[10.5px] text-[var(--color-status-bad)]">−{formatNum(m.ventas30d)}</span>
              </li>
            ))}
            {movers.length === 0 ? (
              <li className="px-4 py-6 text-center text-[12px] text-[var(--color-ink-500)]">
                Sin movimientos registrados.
              </li>
            ) : null}
          </ol>
          <footer className="border-t border-[var(--color-line)] px-4 py-2 text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-ink-500)]">
            Top categorías
          </footer>
          <ul className="divide-y divide-[var(--color-line)]">
            {categoriasTop.map((c) => (
              <li key={c.categoria} className="flex items-center gap-2 px-4 py-2 text-[12px]">
                <span className="font-medium text-[var(--color-ink-900)]">{c.categoria}</span>
                <span className="ml-auto mono text-[var(--color-ink-700)]">{formatArs(c.valor)}</span>
                <span className="mono text-[10.5px] text-[var(--color-ink-500)]">{c.pctValor.toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Buscar">
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-500)]">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="SKU, nombre o categoría"
                className="h-9 w-[240px] rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] pl-8 pr-2 text-[12.5px] focus:border-[var(--color-focus)] focus:outline-none"
              />
            </div>
          </Field>
          <Field label="Categoría">
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as Category | "Todas")}
              className="h-9 w-[200px] rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 text-[12.5px] focus:border-[var(--color-focus)] focus:outline-none"
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Estado">
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as "todos" | "ok" | "bajo" | "critico")}
              className="h-9 w-[180px] rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 text-[12.5px] focus:border-[var(--color-focus)] focus:outline-none"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Ordenar por">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="h-9 w-[180px] rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 text-[12.5px] focus:border-[var(--color-focus)] focus:outline-none"
            >
              <option value="estado">Estado (crítico primero)</option>
              <option value="nombre">Nombre</option>
              <option value="categoria">Categoría</option>
              <option value="stockActual">Stock actual</option>
              <option value="actualizadoEn">Actualizado</option>
            </select>
          </Field>
          <button
            type="button"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            aria-label="Cambiar dirección de orden"
            className="btn-base grid h-9 w-9 place-items-center border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)]"
          >
            <CaretDown size={14} weight="bold" aria-hidden="true" style={{ transform: sortDir === "asc" ? "rotate(180deg)" : "none", transition: "transform 120ms" }} />
          </button>
          <p className="mono ml-auto text-[11px] text-[var(--color-ink-500)]">
            {formatNum(sorted.length)} resultado{sorted.length === 1 ? "" : "s"}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] bg-[var(--color-surface-muted)] text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-ink-500)]">
                <th scope="col" className="px-3 py-2 font-medium">SKU</th>
                <th scope="col" className="px-3 py-2 font-medium">Producto</th>
                <th scope="col" className="hidden px-3 py-2 font-medium sm:table-cell">Categoría</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Stock</th>
                <th scope="col" className="hidden px-3 py-2 text-right font-medium sm:table-cell">Mín.</th>
                <th scope="col" className="hidden px-3 py-2 text-right font-medium sm:table-cell">Precio</th>
                <th scope="col" className="px-3 py-2 font-medium">Estado</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center text-sm text-[var(--color-ink-500)]">
                    Sin productos para los filtros aplicados.
                  </td>
                </tr>
              ) : (
pageRows.map((p) => (
                  <ProductRow
                    key={p.sku}
                    product={p}
                    onAdjust={onAdjust}
                    onSetStock={onSetStock}
                    onRequestSetStock={openSetStockModal}
                    onOpenHistory={(pr) => setHistoryProduct(pr)}
                    onDelete={onDelete}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
        <footer className="flex flex-col items-start justify-between gap-2 border-t border-[var(--color-line)] px-4 py-3 text-[12px] text-[var(--color-ink-500)] sm:flex-row sm:items-center">
          <span>
            Mostrando{" "}
            <span className="mono font-medium text-[var(--color-ink-700)]">
              {sorted.length === 0 ? 0 : safePage * PAGE_SIZE + 1}–
              {Math.min((safePage + 1) * PAGE_SIZE, sorted.length)}
            </span>{" "}
            de <span className="mono">{sorted.length}</span>
            {pageCount > 1 ? (
              <>
                {" · pág "}
                <span className="mono">{safePage + 1}</span>
                <span className="text-[var(--color-ink-300)]">/</span>
                <span className="mono">{pageCount}</span>
              </>
            ) : null}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="btn-base grid h-8 w-8 place-items-center border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Página anterior"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
              className="btn-base grid h-8 w-8 place-items-center border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Página siguiente"
            >
              ›
            </button>
          </div>
        </footer>
      </section>

      {historyProduct ? (
        <ModalShell title={`Historial · ${historyProduct.nombre}`} onClose={() => setHistoryProduct(null)}>
          <MovementHistory
            product={historyProduct}
            onClose={() => setHistoryProduct(null)}
            onAddMovement={(m) => {
              if (!active) return;
              setProducts((arr) => {
                const idx = arr.findIndex((p) => p.sku === historyProduct.sku);
                if (idx === -1) return arr;
                const copy = arr.slice();
                const cur = copy[idx];
                copy[idx] = {
                  ...cur,
                  stockActual: Math.max(0, cur.stockActual + m.cantidad),
                  actualizadoEn: new Date().toISOString().slice(0, 10),
                  movimientos: [
                    ...(cur.movimientos ?? []),
                    {
                      fecha: new Date().toISOString(),
                      tipo: m.tipo,
                      cantidad: m.cantidad,
                      motivo: m.motivo,
                      usuario: active.nombre,
                    },
                  ],
                };
                return copy;
              });
              flash(`Movimiento registrado por ${active.nombre}`);
            }}
          />
        </ModalShell>
      ) : null}

      {csvOpen ? (
        <ModalShell title="Importar productos desde CSV" onClose={() => setCsvOpen(false)}>
          <CSVImporter
            open={csvOpen}
            existingProducts={products}
            onClose={() => setCsvOpen(false)}
            onImport={(rows) => onCsvImport(rows)}
          />
        </ModalShell>
      ) : null}

{confirmReset ? (
        <ModalShell title="Restablecer catálogo" onClose={() => setConfirmReset(false)}>
          <div className="flex flex-col gap-3 text-[13px] text-[var(--color-ink-700)]">
            <p>
              Vas a perder todos los cambios del catálogo y volver al seed
              original ({SEED_PRODUCTS.length} productos).
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="btn-base h-9 border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-[12.5px] hover:bg-[var(--color-surface-muted)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onReset}
                className="btn-base h-9 bg-[var(--color-status-bad)] px-3 text-[12.5px] font-medium text-white hover:opacity-90"
              >
                Confirmar
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {setStockTarget ? (
        <ModalShell
          title={`Fijar stock · ${setStockTarget.nombre}`}
          onClose={() => setSetStockTarget(null)}
        >
          <SetStockForm
            product={setStockTarget}
            onCancel={() => setSetStockTarget(null)}
            onApply={applySetStock}
          />
        </ModalShell>
      ) : null}

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2 text-[12.5px] text-[var(--color-ink-700)] shadow-lg"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon: React.ReactNode;
  tone: "ink" | "warn" | "bad" | "ocean";
}) {
  const accent =
    tone === "bad"
      ? "var(--color-status-bad)"
      : tone === "warn"
        ? "var(--color-alert)"
        : tone === "ocean"
          ? "var(--color-ocean)"
          : "var(--color-ink-700)";
  return (
    <div className="kpi-tile rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--color-ink-500)]">
        <span style={{ color: accent }}>{icon}</span>
        {label}
      </p>
      <p className="mono mt-1 text-[16px] font-semibold leading-tight text-[var(--color-ink-900)]">{value}</p>
      {hint ? <p className="mt-0.5 text-[10.5px] text-[var(--color-ink-500)]">{hint}</p> : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--color-ink-500)]">{label}</span>
      {children}
    </label>
  );
}

function ProductRow({
  product,
  onAdjust,
  onSetStock,
  onRequestSetStock,
  onOpenHistory,
  onDelete,
}: {
  product: Product;
  onAdjust: (sku: string, delta: number) => void;
  onSetStock: (sku: string, value: number) => void;
  onRequestSetStock: (p: Product) => void;
  onOpenHistory: (p: Product) => void;
  onDelete: (sku: string) => void;
}) {
  const status = statusOf(product);
  const movCount = product.movimientos?.length ?? 0;
  const barPct = stockBarPct(product.stockActual, product.stockMinimo);
  return (
    <tr className="dense-row border-b border-[var(--color-line)] hover:bg-[var(--color-surface-muted)]">
      <td className="px-3 py-2.5">
        <a href={`/producto/${encodeURIComponent(product.sku)}`} className="mono text-[12px] text-[var(--color-ocean)] hover:underline">{product.sku}</a>
      </td>
      <td className="px-3 py-2.5">
        <a href={`/producto/${encodeURIComponent(product.sku)}`} className="block max-w-[260px] truncate text-[13px] font-medium hover:text-[var(--color-ocean)]" title={product.nombre}>
          {product.nombre}
        </a>
        <div className="mt-1 stock-bar" aria-hidden="true">
          <span className="stock-bar-fill" data-status={status} style={{ width: `${barPct}%` }} />
        </div>
      </td>
      <td className="hidden px-3 py-2.5 text-[12px] text-[var(--color-ink-700)] sm:table-cell">{product.categoria}</td>
      <td className="px-3 py-2.5">
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => onAdjust(product.sku, -1)}
            disabled={product.stockActual <= 0}
            className="btn-base grid h-8 w-8 place-items-center border border-[var(--color-line)] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)] disabled:opacity-40"
            aria-label={`Restar 1 ${product.unidad} a ${product.nombre}`}
          >−</button>
<button
            type="button"
            onClick={() => onRequestSetStock(product)}
            className="mono min-w-[3.5rem] rounded-sm border border-transparent px-2 py-1 text-right text-[13px] font-medium hover:border-[var(--color-line)]"
            title="Click para fijar stock exacto"
            aria-label={`Fijar stock exacto de ${product.nombre}. Actual: ${formatNum(product.stockActual)} ${product.unidad}.`}
          >
            {formatNum(product.stockActual)}
            <span className="ml-1 font-sans text-[11px] font-normal text-[var(--color-ink-500)]">{product.unidad}</span>
          </button>
          <button
            type="button"
            onClick={() => onAdjust(product.sku, +1)}
            className="btn-base grid h-8 w-8 place-items-center border border-[var(--color-line)] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)]"
            aria-label={`Sumar 1 ${product.unidad} a ${product.nombre}`}
          >+</button>
        </div>
      </td>
      <td className="hidden px-3 py-2.5 text-right text-[var(--color-ink-700)] sm:table-cell">
        <span className="mono">{formatNum(product.stockMinimo)}<span className="ml-1 font-sans text-[11px] text-[var(--color-ink-500)]">{product.unidad}</span></span>
      </td>
      <td className="hidden px-3 py-2.5 text-right text-[var(--color-ink-700)] sm:table-cell">
        <span className="mono">{formatArs(product.precioUnitario)}</span>
      </td>
      <td className="px-3 py-2.5">
        <StatusBadge status={status} />
      </td>
      <td className="px-3 py-2.5 text-right">
        <div className="inline-flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => onOpenHistory(product)}
            className="btn-base grid h-8 w-8 place-items-center border border-[var(--color-line)] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink-900)]"
            aria-label={`Ver historial de ${product.nombre}`}
            title={movCount > 0 ? `Ver historial (${formatNum(movCount)})` : "Ver historial"}
          >
            <span className="relative">
              <ClockCounterClockwise size={14} weight="bold" aria-hidden="true" />
              {movCount > 0 ? (
                <span aria-hidden="true" className="mono absolute -right-2 -top-2 grid h-3.5 min-w-[14px] place-items-center rounded-full bg-[var(--color-ocean)] px-1 text-[9px] font-medium leading-none text-white">
                  {movCount > 99 ? "99+" : movCount}
                </span>
              ) : null}
            </span>
          </button>
          <a href={`/producto/editar?sku=${encodeURIComponent(product.sku)}`} className="btn-base grid h-8 w-8 place-items-center border border-[var(--color-line)] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink-900)]" aria-label={`Editar ${product.nombre}`} title="Editar">
            <PencilSimple size={14} weight="bold" aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`¿Eliminar ${product.nombre}? Esta acción no se puede deshacer.`)) onDelete(product.sku);
            }}
            className="btn-base grid h-8 w-8 place-items-center border border-[var(--color-line)] text-[var(--color-ink-700)] hover:border-[var(--color-status-bad)] hover:bg-[color-mix(in_oklch,var(--color-status-bad)_8%,transparent)] hover:text-[var(--color-status-bad)]"
            aria-label={`Eliminar ${product.nombre}`}
            title="Eliminar"
          >
            <TrashSimple size={14} weight="bold" aria-hidden="true" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-40 flex items-start justify-center bg-[oklch(0_0_0_/_0.45)] px-4 pt-[10vh] backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-2.5">
          <h2 className="text-[13px] font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="grid h-7 w-7 place-items-center rounded-md border border-[var(--color-line)] text-[var(--color-ink-500)] hover:bg-[var(--color-surface-muted)]">
            <X size={12} weight="bold" aria-hidden="true" />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-auto p-4">{children}</div>
      </div>
    </div>
  );
}

// Modal para fijar stock exacto (reemplaza window.prompt, que no es accesible).
function SetStockForm({
  product,
  onCancel,
  onApply,
}: {
  product: Product;
  onCancel: () => void;
  onApply: (value: number) => void;
}) {
  const [value, setValue] = useState<string>(String(product.stockActual));
  const inputRef = useRef<HTMLInputElement>(null);
  const error = useMemo(() => {
    const n = Number(value);
    if (value === "" || !Number.isFinite(n) || n < 0) return "Ingresá un número entero ≥ 0.";
    if (!Number.isInteger(n)) return "El stock debe ser un entero.";
    return null;
  }, [value]);

  useEffect(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (error) return;
    onApply(Number(value));
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 text-[13px]">
      <p className="text-[var(--color-ink-700)]">
        Fijá el stock exacto de <strong>{product.nombre}</strong>{" "}
        <span className="mono text-[12px] text-[var(--color-ink-500)]">({product.sku})</span>.
        Esto registra un movimiento de tipo <em>ajuste</em>.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="set-stock-value" className="mb-1 block text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--color-ink-500)]">
            Stock exacto
          </label>
          <input
            ref={inputRef}
            id="set-stock-value"
            type="number"
            min={0}
            step={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? "set-stock-error" : "set-stock-hint"}
            className="mono h-10 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 text-[13px] focus:border-[var(--color-focus)] focus:outline-none"
          />
          {error ? (
            <p id="set-stock-error" role="alert" className="mt-1 text-[11px] text-[var(--color-status-bad)]">
              {error}
            </p>
          ) : (
            <p id="set-stock-hint" className="mt-1 text-[11px] text-[var(--color-ink-500)]">
              Unidad: <span className="mono">{product.unidad}</span> · Actual: {product.stockActual}
            </p>
          )}
        </div>
        <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-muted)] p-3 text-[11.5px] text-[var(--color-ink-500)]">
          <p className="mb-1 font-medium text-[var(--color-ink-700)]">Resumen</p>
          <p>Cambio neto: <span className="mono">{Number(value) - product.stockActual} {product.unidad}</span></p>
          <p>Stock mínimo: <span className="mono">{product.stockMinimo} {product.unidad}</span></p>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-[var(--color-line)] pt-3">
        <button
          type="button"
          onClick={onCancel}
          className="btn-base h-9 border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-[12.5px] hover:bg-[var(--color-surface-muted)]"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={Boolean(error)}
          className="btn-base h-9 bg-[var(--color-ocean)] px-3 text-[12.5px] font-medium text-white hover:bg-[var(--color-ocean-deep)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Aplicar
        </button>
      </div>
    </form>
  );
}
