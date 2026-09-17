import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowClockwise,
  ArrowsDownUp,
  CaretDown,
  CheckCircle,
  Package,
  PencilSimple,
  Plus,
  TrashSimple,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { SEED_PRODUCTS, type Category, type Product } from "../data/seed";
import {
  deriveKpis,
  formatArs,
  formatNum,
  formatPct,
  statusLabel,
  statusOf,
  type Kpis,
} from "../lib/inventory";
import {
  adjustStock,
  deleteProduct,
  loadProducts,
  resetToSeed,
  setStock,
  writeState,
} from "../lib/storage";

// ---------------------------------------------------------------------------
// Dashboard island
//
// Single client-loaded React island that owns:
//   * the product list (loaded from / persisted to localStorage)
//   * KPI derivation
//   * filters (category, status, search) — search reads ?q= from the URL
//   * the product table with inline +/- stock controls and quick-edit
//   * a "reset to seed" action (clears localStorage)
// ---------------------------------------------------------------------------

const CATEGORY_OPTIONS: { value: Category | "Todas"; label: string }[] = [
  { value: "Todas", label: "Todas las categorías" },
  { value: "Arroz", label: "Arroz" },
  { value: "Fideos", label: "Fideos" },
  { value: "Aceite", label: "Aceite" },
  { value: "Legumbres", label: "Legumbres" },
  { value: "Conservas", label: "Conservas" },
  { value: "Condimentos", label: "Condimentos" },
];

const STATUS_OPTIONS: { value: "todos" | "ok" | "bajo" | "critico"; label: string }[] = [
  { value: "todos", label: "Todos los estados" },
  { value: "ok", label: "Normal" },
  { value: "bajo", label: "Bajo stock" },
  { value: "critico", label: "Crítico" },
];

type SortKey = "nombre" | "categoria" | "stockActual" | "estado" | "actualizadoEn";
type SortDir = "asc" | "desc";

export default function Dashboard() {
  const [hydrated, setHydrated] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categoria, setCategoria] = useState<Category | "Todas">("Todas");
  const [estado, setEstado] = useState<"todos" | "ok" | "bajo" | "critico">(
    "todos",
  );
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("estado");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [confirmReset, setConfirmReset] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  // ----- Hydrate from localStorage on mount -------------------------------
  useEffect(() => {
    setProducts(loadProducts());
    setHydrated(true);
  }, []);

  // ----- Read ?q= from URL on mount and on history change -----------------
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

  // ----- Persist any change -----------------------------------------------
  useEffect(() => {
    if (!hydrated) return;
    writeState(products);
  }, [products, hydrated]);

  // ----- Toast helper -----------------------------------------------------
  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  // ----- Filter + sort ----------------------------------------------------
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (categoria !== "Todas" && p.categoria !== categoria) return false;
      const s = statusOf(p);
      if (estado !== "todos" && s !== estado) return false;
      if (q && !p.nombre.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [products, categoria, estado, query]);

  const sorted = useMemo(() => {
    const copy = filtered.slice();
    const statusRank = { critico: 0, bajo: 1, ok: 2 } as const;
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "nombre":
          cmp = a.nombre.localeCompare(b.nombre, "es");
          break;
        case "categoria":
          cmp = a.categoria.localeCompare(b.categoria, "es");
          break;
        case "stockActual":
          cmp = a.stockActual - b.stockActual;
          break;
        case "estado":
          cmp = statusRank[statusOf(a)] - statusRank[statusOf(b)];
          break;
        case "actualizadoEn":
          cmp = a.actualizadoEn.localeCompare(b.actualizadoEn);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const kpis: Kpis = useMemo(() => deriveKpis(products), [products]);

  // ----- Mutations --------------------------------------------------------
  const onAdjust = useCallback(
    (sku: string, delta: number) => {
      setProducts((prev) => adjustStock(prev, sku, delta));
    },
    [],
  );

  const onSetStock = useCallback((sku: string, value: number) => {
    setProducts((prev) => setStock(prev, sku, value));
  }, []);

  const onDelete = useCallback(
    (sku: string) => {
      const p = products.find((x) => x.sku === sku);
      if (!p) return;
      const ok = window.confirm(`Eliminar "${p.nombre}" (${p.sku})?`);
      if (!ok) return;
      setProducts((prev) => deleteProduct(prev, sku));
      flash(`Producto eliminado: ${p.sku}`);
    },
    [products, flash],
  );

  const onReset = useCallback(() => {
    setProducts(resetToSeed());
    setConfirmReset(false);
    flash("Catálogo restablecido al estado inicial");
  }, [flash]);

  function changeSort(key: SortKey) {
    if (key === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir(key === "estado" ? "asc" : "asc");
    }
  }

  // ----- Render -----------------------------------------------------------
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header strip */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-ink-500)]">
            Panel principal
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--color-ink-900)] sm:text-[28px]">
            Inventario
          </h1>
          <p className="mt-1 text-sm text-[var(--color-ink-700)]">
            Stock actual por SKU. Las alertas se disparan al alcanzar el umbral
            configurado por producto.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/producto/nuevo"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--color-ink-900)] px-3 text-sm font-medium text-[var(--color-canvas)] transition-colors hover:bg-[var(--color-ink-700)] active:translate-y-px"
          >
            <Plus size={14} weight="bold" aria-hidden="true" />
            Nuevo producto
          </a>
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-ink-700)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink-900)] active:translate-y-px"
          >
            <ArrowClockwise size={14} weight="bold" aria-hidden="true" />
            Restablecer
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <KpiStrip kpis={kpis} />

      {/* Filters */}
      <section
        aria-label="Filtros"
        className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-4 sm:p-5"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_220px_220px]">
          <div>
            <label
              htmlFor="f-q"
              className="mb-1.5 block text-xs font-medium text-[var(--color-ink-700)]"
            >
              Buscar
            </label>
            <div className="relative">
              <input
                id="f-q"
                type="search"
                placeholder="SKU o nombre"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-10 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-500)] focus:border-[var(--color-ink-700)] focus:outline-none"
              />
            </div>
          </div>

          <FilterSelect<Category | "Todas">
            id="f-cat"
            label="Categoría"
            value={categoria}
            onChange={(v) => setCategoria(v)}
            options={CATEGORY_OPTIONS}
          />
          <FilterSelect<"todos" | "ok" | "bajo" | "critico">
            id="f-status"
            label="Estado"
            value={estado}
            onChange={(v) => setEstado(v)}
            options={STATUS_OPTIONS}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-line)] pt-3 text-xs text-[var(--color-ink-500)]">
          <p>
            Mostrando{" "}
            <span className="font-mono text-[var(--color-ink-900)]">
              {sorted.length}
            </span>{" "}
            de{" "}
            <span className="font-mono text-[var(--color-ink-900)]">
              {products.length}
            </span>{" "}
            productos
          </p>
          {query || categoria !== "Todas" || estado !== "todos" ? (
            <button
              type="button"
              onClick={() => {
                setCategoria("Todas");
                setEstado("todos");
                setQuery("");
                const url = new URL(window.location.href);
                url.searchParams.delete("q");
                window.history.replaceState({}, "", url.pathname + (url.search || ""));
              }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink-900)]"
            >
              <X size={12} weight="bold" aria-hidden="true" />
              Limpiar filtros
            </button>
          ) : null}
        </div>
      </section>

      {/* Table */}
      <section
        aria-label="Listado de productos"
        className="overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)]"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] bg-[var(--color-surface-muted)] text-left text-[11px] uppercase tracking-[0.08em] text-[var(--color-ink-500)]">
                <Th onClick={() => changeSort("nombre")} active={sortKey === "nombre"} dir={sortDir}>
                  Producto
                </Th>
                <Th
                  onClick={() => changeSort("categoria")}
                  active={sortKey === "categoria"}
                  dir={sortDir}
                  hideOnMobile
                >
                  Categoría
                </Th>
                <Th
                  onClick={() => changeSort("stockActual")}
                  active={sortKey === "stockActual"}
                  dir={sortDir}
                  align="right"
                >
                  Stock
                </Th>
                <Th align="right" hideOnMobile>
                  Mínimo
                </Th>
                <Th align="right" hideOnMobile>
                  Precio
                </Th>
                <Th
                  onClick={() => changeSort("estado")}
                  active={sortKey === "estado"}
                  dir={sortDir}
                >
                  Estado
                </Th>
                <Th align="right">Acciones</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {!hydrated ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-[var(--color-ink-500)]">
                    Cargando…
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center">
                    <p className="text-sm text-[var(--color-ink-700)]">
                      No hay productos que coincidan con los filtros aplicados.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setCategoria("Todas");
                        setEstado("todos");
                        setQuery("");
                      }}
                      className="mt-3 inline-flex items-center gap-1 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1.5 text-xs text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)]"
                    >
                      Limpiar filtros
                    </button>
                  </td>
                </tr>
              ) : (
                sorted.map((p) => (
                  <ProductRow
                    key={p.sku}
                    product={p}
                    onAdjust={onAdjust}
                    onSetStock={onSetStock}
                    onDelete={onDelete}
                    flash={flash}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Reset confirm modal */}
      {confirmReset ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-title"
          className="fixed inset-0 z-40 grid place-items-center bg-[var(--color-ink-900)]/40 p-4"
        >
          <div className="w-full max-w-sm rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-xl">
            <h2
              id="reset-title"
              className="text-base font-semibold text-[var(--color-ink-900)]"
            >
              Restablecer el catálogo
            </h2>
            <p className="mt-2 text-sm text-[var(--color-ink-700)]">
              Esta acción reemplaza todos los productos en este navegador por el
              catálogo inicial. No se puede deshacer.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="h-9 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onReset}
                className="h-9 rounded-md bg-[var(--color-status-bad)] px-3 text-sm font-medium text-white hover:opacity-90"
              >
                Sí, restablecer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Toast */}
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink-900)] shadow-lg"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function KpiStrip({ kpis }: { kpis: Kpis }) {
  return (
    <section
      aria-label="Indicadores"
      className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-4"
    >
      <Kpi
        icon={<Package size={16} weight="duotone" aria-hidden="true" />}
        label="Productos"
        value={formatNum(kpis.totalProductos)}
        sub={`${formatNum(kpis.totalCategorias)} categorías`}
      />
      <Kpi
        icon={
          <WarningCircle
            size={16}
            weight="duotone"
            aria-hidden="true"
            className="text-[var(--color-status-warn)]"
          />
        }
        label="Bajo stock"
        value={formatNum(kpis.bajoStockCount)}
        sub={formatPct(kpis.bajoStockPct / 100)}
        tone={kpis.bajoStockCount > 0 ? "warn" : "neutral"}
      />
      <Kpi
        icon={
          <WarningCircle
            size={16}
            weight="duotone"
            aria-hidden="true"
            className="text-[var(--color-status-bad)]"
          />
        }
        label="Críticos"
        value={formatNum(kpis.criticoCount)}
        sub={
          kpis.criticoCount > 0
            ? "Reposición urgente"
            : "Sin alertas críticas"
        }
        tone={kpis.criticoCount > 0 ? "bad" : "neutral"}
      />
      <Kpi
        icon={<ArrowsDownUp size={16} weight="duotone" aria-hidden="true" />}
        label="Valor estimado"
        value={formatArs(kpis.valorInventario)}
        sub="Stock × precio unitario"
      />
    </section>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone?: "neutral" | "warn" | "bad";
}) {
  const valueClass =
    tone === "bad"
      ? "text-[var(--color-status-bad)]"
      : tone === "warn"
        ? "text-[var(--color-status-warn)]"
        : "text-[var(--color-ink-900)]";
  return (
    <div className="kpi-tile flex flex-col gap-2 bg-[var(--color-surface)] p-4">
      <div className="flex items-center gap-2 text-[var(--color-ink-500)]">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-[0.08em]">
          {label}
        </span>
      </div>
      <p
        className={`tabular text-2xl font-semibold leading-none tracking-tight ${valueClass}`}
      >
        {value}
      </p>
      <p className="text-xs text-[var(--color-ink-500)]">{sub}</p>
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  dir,
  align = "left",
  hideOnMobile = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  dir?: SortDir;
  align?: "left" | "right";
  hideOnMobile?: boolean;
}) {
  const alignClass = align === "right" ? "text-right" : "text-left";
  const mobileClass = hideOnMobile ? "hidden sm:table-cell" : "";
  if (!onClick) {
    return (
      <th
        scope="col"
        className={`${alignClass} ${mobileClass} px-3 py-2 font-medium`}
      >
        {children}
      </th>
    );
  }
  return (
    <th
      scope="col"
      className={`${alignClass} ${mobileClass} px-3 py-2 font-medium`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 rounded-sm transition-colors hover:text-[var(--color-ink-900)] ${
          active ? "text-[var(--color-ink-900)]" : ""
        }`}
      >
        {children}
        <CaretDown
          size={10}
          weight="bold"
          aria-hidden="true"
          className={`transition-transform ${
            active && dir === "desc" ? "rotate-180" : ""
          }`}
        />
      </button>
    </th>
  );
}

function FilterSelect<T extends string>({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-medium text-[var(--color-ink-700)]"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-10 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-ink-900)] focus:border-[var(--color-ink-700)] focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ProductRow({
  product,
  onAdjust,
  onSetStock,
  onDelete,
  flash,
}: {
  product: Product;
  onAdjust: (sku: string, delta: number) => void;
  onSetStock: (sku: string, value: number) => void;
  onDelete: (sku: string) => void;
  flash: (msg: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(product.stockActual));
  const status = statusOf(product);

  useEffect(() => {
    setDraft(String(product.stockActual));
  }, [product.stockActual]);

  function commit() {
    const n = Number(draft);
    if (!Number.isFinite(n) || n < 0) {
      flash("Valor inválido — no se aplicó el cambio");
      setDraft(String(product.stockActual));
      setEditing(false);
      return;
    }
    if (n !== product.stockActual) {
      onSetStock(product.sku, n);
      flash(`${product.sku} → ${formatNum(n)} ${product.unidad}`);
    }
    setEditing(false);
  }

  return (
    <tr className="group align-middle">
      <td className="px-3 py-3">
        <div className="flex items-start gap-3">
          <span
            className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{
              backgroundColor:
                status === "critico"
                  ? "var(--color-status-bad)"
                  : status === "bajo"
                    ? "var(--color-status-warn)"
                    : "var(--color-status-ok)",
            }}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="truncate font-medium text-[var(--color-ink-900)]">
              {product.nombre}
            </p>
            <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--color-ink-500)]">
              {product.sku}
            </p>
          </div>
        </div>
      </td>
      <td className="hidden px-3 py-3 text-[var(--color-ink-700)] sm:table-cell">
        {product.categoria}
      </td>
      <td className="px-3 py-3 text-right">
        {editing ? (
          <div className="inline-flex items-center gap-1">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") {
                  setDraft(String(product.stockActual));
                  setEditing(false);
                }
              }}
              aria-label={`Stock actual de ${product.nombre}`}
              className="tabular h-8 w-20 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 text-right text-sm text-[var(--color-ink-900)] focus:border-[var(--color-ink-700)] focus:outline-none"
            />
            <button
              type="button"
              onClick={commit}
              className="grid h-8 w-8 place-items-center rounded-md bg-[var(--color-ink-900)] text-[var(--color-canvas)] hover:bg-[var(--color-ink-700)]"
              aria-label="Guardar stock"
            >
              <CheckCircle size={14} weight="bold" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(String(product.stockActual));
                setEditing(false);
              }}
              className="grid h-8 w-8 place-items-center rounded-md border border-[var(--color-line)] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)]"
              aria-label="Cancelar edición"
            >
              <X size={14} weight="bold" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="inline-flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => onAdjust(product.sku, -1)}
              disabled={product.stockActual <= 0}
              aria-label={`Restar 1 ${product.unidad} a ${product.nombre}`}
              className="grid h-8 w-8 place-items-center rounded-md border border-[var(--color-line)] text-[var(--color-ink-700)] transition-colors hover:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="tabular min-w-[3.5rem] rounded-md border border-transparent px-2 py-1 text-right font-semibold text-[var(--color-ink-900)] hover:border-[var(--color-line)]"
              aria-label={`Editar stock de ${product.nombre}`}
            >
              {formatNum(product.stockActual)}
              <span className="ml-1 text-[11px] font-normal text-[var(--color-ink-500)]">
                {product.unidad}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onAdjust(product.sku, +1)}
              aria-label={`Sumar 1 ${product.unidad} a ${product.nombre}`}
              className="grid h-8 w-8 place-items-center rounded-md border border-[var(--color-line)] text-[var(--color-ink-700)] transition-colors hover:bg-[var(--color-surface-muted)]"
            >
              +
            </button>
          </div>
        )}
      </td>
      <td className="hidden px-3 py-3 text-right font-mono text-[var(--color-ink-700)] sm:table-cell">
        {formatNum(product.stockMinimo)}
        <span className="ml-1 text-[11px] text-[var(--color-ink-500)]">
          {product.unidad}
        </span>
      </td>
      <td className="hidden px-3 py-3 text-right font-mono text-[var(--color-ink-700)] sm:table-cell">
        {formatArs(product.precioUnitario)}
      </td>
      <td className="px-3 py-3">
        <StatusBadge status={status} />
      </td>
      <td className="px-3 py-3 text-right">
        <div className="inline-flex items-center justify-end gap-1">
          <a
            href={`/producto/editar?sku=${encodeURIComponent(product.sku)}`}
            className="grid h-8 w-8 place-items-center rounded-md border border-[var(--color-line)] text-[var(--color-ink-700)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink-900)]"
            aria-label={`Editar ${product.nombre}`}
            title="Editar"
          >
            <PencilSimple size={14} weight="regular" aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={() => onDelete(product.sku)}
            className="grid h-8 w-8 place-items-center rounded-md border border-[var(--color-line)] text-[var(--color-ink-700)] transition-colors hover:border-[var(--color-status-bad)] hover:bg-[var(--color-status-bad)]/10 hover:text-[var(--color-status-bad)]"
            aria-label={`Eliminar ${product.nombre}`}
            title="Eliminar"
          >
            <TrashSimple size={14} weight="regular" aria-hidden="true" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function StatusBadge({
  status,
}: {
  status: "ok" | "bajo" | "critico";
}) {
  const palette = {
    ok: {
      fg: "var(--color-status-ok)",
      bg: "color-mix(in oklch, var(--color-status-ok) 12%, transparent)",
      label: statusLabel("ok"),
      border: "color-mix(in oklch, var(--color-status-ok) 35%, transparent)",
    },
    bajo: {
      fg: "var(--color-status-warn)",
      bg: "color-mix(in oklch, var(--color-status-warn) 14%, transparent)",
      label: statusLabel("bajo"),
      border: "color-mix(in oklch, var(--color-status-warn) 40%, transparent)",
    },
    critico: {
      fg: "var(--color-status-bad)",
      bg: "color-mix(in oklch, var(--color-status-bad) 14%, transparent)",
      label: statusLabel("critico"),
      border: "color-mix(in oklch, var(--color-status-bad) 45%, transparent)",
    },
  } as const;
  const p = palette[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{ color: p.fg, backgroundColor: p.bg, borderColor: p.border }}
    >
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: p.fg }}
      />
      {p.label}
    </span>
  );
}

// Suppress unused warning while keeping reference for future use
void SEED_PRODUCTS;
