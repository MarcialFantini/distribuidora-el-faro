import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowsClockwise,
  CalendarBlank,
  CircleNotch,
  Funnel,
} from "@phosphor-icons/react";
import {
  type MovementType,
  type Product,
} from "../data/seed";
import {
  flattenMovements,
  formatNum,
  type MovementWithProduct,
} from "../lib/inventory";
import { loadProducts } from "../lib/storage";
import DataTable, { type Column } from "./DataTable";

// ---------------------------------------------------------------------------
// MovementsView — date-range picker + filtros tipo/producto + tabla
// paginada con todos los movimientos del catálogo.
// ---------------------------------------------------------------------------

const TIPO_OPTIONS: { value: "todos" | MovementType; label: string }[] = [
  { value: "todos", label: "Todos los tipos" },
  { value: "entrada", label: "Entradas" },
  { value: "salida", label: "Salidas" },
  { value: "ajuste", label: "Ajustes" },
];

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function MovementsView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [tipo, setTipo] = useState<"todos" | MovementType>("todos");
  const [sku, setSku] = useState<string>("todos");

  useEffect(() => {
    const list = loadProducts();
    setProducts(list);
    setHydrated(true);
    // Defaults: últimos 30 días.
    const today = new Date();
    const past = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    setFrom(isoDay(past));
    setTo(isoDay(today));
  }, []);

  const filtered = useMemo(() => {
    const all = flattenMovements(products);
    return all.filter((m) => {
      const day = m.fecha.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (tipo !== "todos" && m.tipo !== tipo) return false;
      if (sku !== "todos" && m.sku !== sku) return false;
      return true;
    });
  }, [products, from, to, tipo, sku]);

  const resetKey = `${from}|${to}|${tipo}|${sku}`;

  const columns: Column<MovementWithProduct>[] = [
    {
      key: "fecha",
      header: "Fecha",
      width: "16%",
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
      width: "9%",
      sortBy: (m) => m.tipo,
      render: (m) => <TipoBadge tipo={m.tipo} />,
    },
    {
      key: "sku",
      header: "SKU",
      width: "12%",
      sortBy: (m) => m.sku,
      render: (m) => (
        <a
          href={`/producto/${encodeURIComponent(m.sku)}`}
          className="mono text-[12px] text-[var(--color-ocean)] hover:underline"
        >
          {m.sku}
        </a>
      ),
    },
    {
      key: "nombre",
      header: "Producto",
      sortBy: (m) => m.nombre,
      render: (m) => (
        <span className="text-[12.5px] text-[var(--color-ink-700)]">{m.nombre}</span>
      ),
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
          {formatNum(m.cantidad)} {m.unidad}
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
      width: "14%",
      showOnMobile: false,
      sortBy: (m) => m.usuario,
      render: (m) => (
        <span className="mono text-[12px] text-[var(--color-ink-500)]">{m.usuario}</span>
      ),
    },
  ];

  if (!hydrated) {
    return (
      <div className="grid place-items-center py-20 text-[var(--color-ink-500)]">
        <CircleNotch size={20} weight="bold" className="animate-spin" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow">Histórico de movimientos</p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-tight">Movimientos</h1>
          <p className="text-[13px] text-[var(--color-ink-500)]">
            Filtrá por rango de fechas, tipo y producto. {filtered.length.toLocaleString("es-AR")} resultados.
          </p>
        </div>
      </header>

      <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Desde">
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 w-[160px] rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 text-[12.5px] text-[var(--color-ink-900)] focus:border-[var(--color-focus)] focus:outline-none"
            />
          </Field>
          <Field label="Hasta">
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 w-[160px] rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 text-[12.5px] text-[var(--color-ink-900)] focus:border-[var(--color-focus)] focus:outline-none"
            />
          </Field>
          <Field label="Tipo">
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as "todos" | MovementType)}
              className="h-9 w-[160px] rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 text-[12.5px] text-[var(--color-ink-900)] focus:border-[var(--color-focus)] focus:outline-none"
            >
              {TIPO_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Producto">
            <select
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="h-9 w-[260px] rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 text-[12.5px] text-[var(--color-ink-900)] focus:border-[var(--color-focus)] focus:outline-none"
            >
              <option value="todos">Todos los productos</option>
              {products.map((p) => (
                <option key={p.sku} value={p.sku}>
                  {p.sku} — {p.nombre}
                </option>
              ))}
            </select>
          </Field>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                setFrom(isoDay(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)));
                setTo(isoDay(today));
              }}
              className="btn-base h-9 border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 text-[11.5px] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)]"
            >
              <CalendarBlank size={12} weight="bold" aria-hidden="true" />
              7 días
            </button>
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                setFrom(isoDay(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)));
                setTo(isoDay(today));
              }}
              className="btn-base h-9 border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 text-[11.5px] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)]"
            >
              30 días
            </button>
            <button
              type="button"
              onClick={() => {
                setTipo("todos");
                setSku("todos");
                const today = new Date();
                setFrom(isoDay(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)));
                setTo(isoDay(today));
              }}
              className="btn-base h-9 border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 text-[11.5px] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)]"
            >
              <Funnel size={12} weight="bold" aria-hidden="true" />
              Limpiar
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)]">
        <div className="p-3">
          <DataTable
            columns={columns}
            rows={filtered}
            pageSize={20}
            initialSort={{ key: "fecha", dir: "desc" }}
            resetKey={resetKey}
            tableId="all-movs"
            totalLabel="movimientos"
            emptyMessage="No hay movimientos para los filtros aplicados."
          />
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--color-ink-500)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function TipoBadge({ tipo }: { tipo: MovementType }) {
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
