import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  ArrowsClockwise,
  ChartLineUp,
  CircleNotch,
  Minus,
  Package,
  PencilSimple,
  Plus,
  Storefront,
} from "@phosphor-icons/react";
import {
  type Movimiento,
  type Product,
  type Proveedor,
} from "../data/seed";
import {
  formatArs,
  formatNum,
  formatNumDec,
  statusLabel,
  statusOf,
  stockEvolutionByMonth,
} from "../lib/inventory";
import {
  adjustStock,
  loadProducts,
  loadProveedores,
  replaceAll,
  setStock,
} from "../lib/storage";
import { useOperario } from "./OperarioContext";
import StockChart from "./StockChart";
import DataTable, { type Column } from "./DataTable";
import StatusBadge from "./StatusBadge";

// ---------------------------------------------------------------------------
// ProductDetail — vista completa de un producto.
//
// Se monta como client-only (porque el dato vive en localStorage). El SKU
// se resuelve desde la URL en cliente.
// ---------------------------------------------------------------------------

interface Props {
  initialSku?: string;
}

export default function ProductDetail({ initialSku }: Props) {
  const { active } = useOperario();
  const [products, setProducts] = useState<Product[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [sku, setSku] = useState<string>(initialSku ?? "");
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<"historial" | "metricas">("historial");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setProducts(loadProducts());
    setProveedores(loadProveedores());
    if (!sku && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get("sku");
      if (fromQuery) setSku(fromQuery);
      else {
        const last = window.location.pathname.split("/").pop() ?? "";
        if (last) setSku(decodeURIComponent(last));
      }
    }
    setHydrated(true);
  }, []);

  const product = useMemo(() => products.find((p) => p.sku === sku), [products, sku]);
  const proveedor = useMemo(
    () => (product?.proveedorId ? proveedores.find((pr) => pr.id === product.proveedorId) : null),
    [product, proveedores],
  );

  const chart = useMemo(
    () => (product ? stockEvolutionByMonth(product, 6) : []),
    [product],
  );

  if (!hydrated) {
    return (
      <div className="grid place-items-center py-20 text-[var(--color-ink-500)]">
        <CircleNotch size={20} weight="bold" className="animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-ink-700)]">
        <p className="font-medium">Producto no encontrado.</p>
        <p className="mt-1 text-[var(--color-ink-500)]">
          El SKU <code className="font-mono">{sku || "—"}</code> no existe en el catálogo.
        </p>
        <a
          href="/"
          className="mt-3 inline-flex items-center gap-1 text-[var(--color-ocean)] hover:underline"
        >
          <ArrowLeft size={12} weight="bold" aria-hidden="true" />
          Volver al inventario
        </a>
      </div>
    );
  }

  const status = statusOf(product);
  const movimientos = (product.movimientos ?? []).slice().sort((a, b) => b.fecha.localeCompare(a.fecha));

  function apply(fn: (arr: Product[]) => Product[]) {
    const next = fn(products);
    setProducts(next);
    replaceAll({ products: next });
  }

  function onAdjust(delta: number) {
    if (!active) return;
    apply((arr) => adjustStock(arr, product!.sku, delta, active.nombre));
    setToast(delta > 0 ? `Sumaste ${delta} ${product!.unidad}` : `Restaste ${Math.abs(delta)} ${product!.unidad}`);
    setTimeout(() => setToast(null), 2200);
  }

  function onSetTo(min: number) {
    if (!active) return;
    apply((arr) => setStock(arr, product!.sku, min, active.nombre));
    setToast(`Stock fijado en ${min} ${product!.unidad}`);
    setTimeout(() => setToast(null), 2200);
  }

  const stockRatio = product.stockMinimo <= 0
    ? 1
    : Math.min(1, product.stockActual / product.stockMinimo);
  const stockPct = (stockRatio * 100).toFixed(0);

  const columns: Column<Movimiento>[] = [
    {
      key: "fecha",
      header: "Fecha",
      width: "20%",
      sortBy: (m) => m.fecha,
      render: (m) => (
        <span className="mono text-[12px] text-[var(--color-ink-700)]">
          {new Date(m.fecha).toLocaleString("es-AR", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
    },
    {
      key: "tipo",
      header: "Tipo",
      width: "10%",
      sortBy: (m) => m.tipo,
      render: (m) => <TipoBadge tipo={m.tipo} />,
    },
    {
      key: "cantidad",
      header: "Δ",
      align: "right",
      width: "10%",
      sortBy: (m) => m.cantidad,
      render: (m) => (
        <span
          className={`mono text-[12.5px] ${
            m.cantidad > 0
              ? "text-[var(--color-status-ok)]"
              : m.cantidad < 0
                ? "text-[var(--color-status-bad)]"
                : "text-[var(--color-ink-500)]"
          }`}
        >
          {m.cantidad > 0 ? "+" : ""}
          {formatNum(m.cantidad)} {product.unidad}
        </span>
      ),
    },
    {
      key: "motivo",
      header: "Motivo",
      sortBy: (m) => m.motivo,
      render: (m) => (
        <span className="text-[12.5px] text-[var(--color-ink-700)]">{m.motivo}</span>
      ),
    },
    {
      key: "usuario",
      header: "Operario",
      width: "16%",
      showOnMobile: false,
      sortBy: (m) => m.usuario,
      render: (m) => (
        <span className="mono text-[12px] text-[var(--color-ink-500)]">{m.usuario}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <nav className="flex items-center gap-1 text-[12px] text-[var(--color-ink-500)]">
        <a href="/" className="hover:text-[var(--color-ocean)]">Inventario</a>
        <span aria-hidden="true">/</span>
        <span className="text-[var(--color-ink-700)]">{product.nombre}</span>
      </nav>

      <header className="flex flex-col gap-3 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">{product.categoria}</p>
            <h1 className="mt-1 truncate text-[20px] font-semibold tracking-tight">
              {product.nombre}
            </h1>
            <p className="mono mt-1 text-[12px] text-[var(--color-ink-500)]">
              SKU {product.sku}
              {proveedor ? <> · surte {proveedor.nombre}</> : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            <a
              href={`/producto/editar?sku=${encodeURIComponent(product.sku)}`}
              className="btn-base h-9 border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-[12.5px] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)]"
            >
              <PencilSimple size={13} weight="bold" aria-hidden="true" />
              Editar
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-3 sm:grid-cols-4">
          <Stat label="Stock actual" value={`${formatNum(product.stockActual)} ${product.unidad}`} />
          <Stat label="Stock mínimo" value={`${formatNum(product.stockMinimo)} ${product.unidad}`} />
          <Stat
            label="Cobertura"
            value={
              product.stockMinimo > 0
                ? `${stockPct}% del mínimo`
                : "Sin umbral"
            }
          />
          <Stat label="Precio unitario" value={formatArs(product.precioUnitario)} />
        </div>

        <div className="mt-2">
          <div className="stock-bar stock-bar-marked" aria-hidden="true">
            <span
              className="stock-bar-fill"
              data-status={status}
              style={{ width: `${Math.min(100, stockRatio * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-ink-500)]">
            Estado: {statusLabel(status)}
            {status !== "ok" ? (
              <span className="ml-1 text-[var(--color-status-bad)]">
                (faltan {formatNum(Math.max(0, product.stockMinimo - product.stockActual))} {product.unidad} para alcanzar el mínimo)
              </span>
            ) : null}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--color-line)] pt-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-ink-500)]">
            Ajuste rápido
          </span>
          <button
            type="button"
            onClick={() => onAdjust(-10)}
            disabled={!active}
            className="btn-base h-8 border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 text-[12px] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
          >
            −10
          </button>
          <button
            type="button"
            onClick={() => onAdjust(-1)}
            disabled={!active || product.stockActual <= 0}
            className="btn-base grid h-8 w-8 place-items-center border border-[var(--color-line)] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
            aria-label="Restar 1"
          >
            <Minus size={12} weight="bold" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onAdjust(+1)}
            disabled={!active}
            className="btn-base grid h-8 w-8 place-items-center border border-[var(--color-line)] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
            aria-label="Sumar 1"
          >
            <Plus size={12} weight="bold" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onAdjust(+10)}
            disabled={!active}
            className="btn-base h-8 border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 text-[12px] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
          >
            +10
          </button>
          <button
            type="button"
            onClick={() => onSetTo(product.stockMinimo)}
            disabled={!active}
            className="btn-base ml-auto h-8 border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 text-[12px] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
            title="Fijar stock al mínimo exacto"
          >
            <ArrowsClockwise size={12} weight="bold" aria-hidden="true" />
            A mínimo
          </button>
        </div>
        {toast ? (
          <p
            role="status"
            aria-live="polite"
            className="mono text-[11.5px] text-[var(--color-status-ok)]"
          >
            {toast}
          </p>
        ) : null}
      </header>

      <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)]">
        <header className="flex items-center justify-between gap-2 border-b border-[var(--color-line)] px-4 py-2.5">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold">
            <ChartLineUp size={14} weight="bold" aria-hidden="true" className="text-[var(--color-ocean)]" />
            Evolución de stock · últimos 6 meses
          </h2>
          <div className="inline-flex rounded-md border border-[var(--color-line)] bg-[var(--color-surface-muted)] p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setTab("historial")}
              className={`rounded px-2 py-1 ${tab === "historial" ? "bg-[var(--color-surface)] text-[var(--color-ink-900)] shadow-sm" : "text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)]"}`}
            >
              Historial
            </button>
            <button
              type="button"
              onClick={() => setTab("metricas")}
              className={`rounded px-2 py-1 ${tab === "metricas" ? "bg-[var(--color-surface)] text-[var(--color-ink-900)] shadow-sm" : "text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)]"}`}
            >
              Métricas
            </button>
          </div>
        </header>
        <div className="px-4 pb-4 pt-3">
          <StockChart data={chart} unitLabel={product.unidad} />
        </div>
      </section>

      <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)]">
        <header className="flex items-center justify-between gap-2 border-b border-[var(--color-line)] px-4 py-2.5">
          <h2 className="text-[13px] font-semibold">Historial de movimientos</h2>
          <p className="mono text-[11px] text-[var(--color-ink-500)]">
            {formatNum(movimientos.length)} entradas
          </p>
        </header>
        <div className="p-3">
          <DataTable
            columns={columns}
            rows={movimientos}
            pageSize={10}
            initialSort={{ key: "fecha", dir: "desc" }}
            tableId={`mov-${product.sku}`}
            totalLabel="movimientos"
            emptyMessage="Sin movimientos registrados para este producto."
          />
        </div>
      </section>

      {proveedor ? (
        <section className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid h-9 w-9 place-items-center rounded-md bg-[var(--color-ocean-soft)] text-[var(--color-ocean)]"
            >
              <Storefront size={16} weight="bold" />
            </span>
            <div>
              <p className="text-[13px] font-medium">Proveedor: {proveedor.nombre}</p>
              <p className="mono text-[11px] text-[var(--color-ink-500)]">
                {proveedor.contacto} · {proveedor.telefono}
              </p>
            </div>
          </div>
          <a
            href={`/proveedores#${proveedor.id}`}
            className="btn-base h-8 border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-[12px] hover:bg-[var(--color-surface-muted)]"
          >
            Ver proveedor
          </a>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-muted)] px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--color-ink-500)]">
        {label}
      </p>
      <p className="mono mt-1 text-[15px] font-semibold leading-tight text-[var(--color-ink-900)]">
        {value}
      </p>
    </div>
  );
}

function TipoBadge({ tipo }: { tipo: Movimiento["tipo"] }) {
  if (tipo === "entrada")
    return (
      <span
        className="mono inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.04em]"
        style={{
          color: "var(--color-status-ok)",
          backgroundColor: "color-mix(in oklch, var(--color-status-ok) 14%, transparent)",
          borderColor: "color-mix(in oklch, var(--color-status-ok) 38%, transparent)",
        }}
      >
        <ArrowUp size={9} weight="bold" aria-hidden="true" />
        Entrada
      </span>
    );
  if (tipo === "salida")
    return (
      <span
        className="mono inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.04em]"
        style={{
          color: "var(--color-status-bad)",
          backgroundColor: "color-mix(in oklch, var(--color-status-bad) 14%, transparent)",
          borderColor: "color-mix(in oklch, var(--color-status-bad) 38%, transparent)",
        }}
      >
        <ArrowDown size={9} weight="bold" aria-hidden="true" />
        Salida
      </span>
    );
  return (
    <span
      className="mono inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.04em]"
      style={{
        color: "var(--color-ocean)",
        backgroundColor: "var(--color-ocean-soft)",
        borderColor: "color-mix(in oklch, var(--color-ocean) 38%, transparent)",
      }}
    >
      <ArrowsClockwise size={9} weight="bold" aria-hidden="true" />
      Ajuste
    </span>
  );
}

// Re-export for Astro import convenience.
export { Package };
