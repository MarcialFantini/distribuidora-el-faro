import { useEffect } from "react";
import {
  ArrowDown,
  ArrowsLeftRight,
  ArrowUp,
  Clock,
  X,
} from "@phosphor-icons/react";
import type { Movimiento, MovementType, Product } from "../data/seed";
import { formatNum } from "../lib/inventory";
import { movimientosOf } from "../lib/storage";

// ---------------------------------------------------------------------------
// MovementHistory
//
// Drawer lateral (slide-in desde la derecha) con la lista cronológica
// de movimientos de stock de UN producto.
//
// Empty state: "Sin movimientos registrados todavía" (texto literal del brief).
// Cada fila muestra:
//   - ícono + color según tipo (entrada / salida / ajuste)
//   - cantidad con signo (+12 / −4)
//   - motivo
//   - usuario
//   - fecha formateada es-AR (DD/MM/YYYY HH:mm)
//
// Accesibilidad: panel role="dialog" con aria-modal y label. Cierre con
// ESC, click en backdrop o botón X.
// ---------------------------------------------------------------------------

interface Props {
  open: boolean;
  product: Product | null;
  onClose: () => void;
}

const TYPE_STYLE: Record<
  MovementType,
  {
    label: string;
    fg: string;
    bg: string;
    border: string;
    icon: React.ReactNode;
  }
> = {
  entrada: {
    label: "Entrada",
    fg: "var(--color-status-ok)",
    bg: "color-mix(in oklch, var(--color-status-ok) 14%, transparent)",
    border: "color-mix(in oklch, var(--color-status-ok) 38%, transparent)",
    icon: <ArrowUp size={12} weight="bold" aria-hidden="true" />,
  },
  salida: {
    label: "Salida",
    fg: "var(--color-status-bad)",
    bg: "color-mix(in oklch, var(--color-status-bad) 14%, transparent)",
    border: "color-mix(in oklch, var(--color-status-bad) 38%, transparent)",
    icon: <ArrowDown size={12} weight="bold" aria-hidden="true" />,
  },
  ajuste: {
    label: "Ajuste",
    fg: "var(--color-ocean)",
    bg: "color-mix(in oklch, var(--color-ocean) 12%, transparent)",
    border: "color-mix(in oklch, var(--color-ocean) 36%, transparent)",
    icon: <ArrowsLeftRight size={12} weight="bold" aria-hidden="true" />,
  },
};

const dateFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatFecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return dateFmt.format(d);
}

export default function MovementHistory({ open, product, onClose }: Props) {
  // Close on ESC
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !product) return null;

  const movimientos = movimientosOf(product);
  // Más recientes primero
  const ordered = movimientos
    .slice()
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <div
      className="fixed inset-0 z-40"
      aria-hidden={false}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Cerrar historial"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[var(--color-ink-900)]/40"
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-[var(--color-line)] bg-[var(--color-surface)] shadow-2xl"
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-3 border-b border-[var(--color-line)] px-5 py-4">
          <div className="min-w-0">
            <p className="eyebrow">Historial de movimientos</p>
            <h2
              id="history-title"
              className="mt-1 truncate text-base font-semibold text-[var(--color-ink-900)]"
            >
              {product.nombre}
            </h2>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-[var(--color-ink-500)]">
              <span className="mono uppercase tracking-[0.04em]">
                {product.sku}
              </span>
              <span aria-hidden="true">·</span>
              <span>{product.categoria}</span>
              <span aria-hidden="true">·</span>
              <span className="mono">
                Stock {formatNum(product.stockActual)} {product.unidad}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar historial"
            className="btn-base grid h-8 w-8 shrink-0 place-items-center text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)]"
          >
            <X size={14} weight="bold" aria-hidden="true" />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {ordered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <span
                aria-hidden="true"
                className="grid h-10 w-10 place-items-center rounded-md border border-[var(--color-line)] bg-[var(--color-surface-muted)] text-[var(--color-ink-500)]"
              >
                <Clock size={18} weight="bold" />
              </span>
              <p className="text-sm text-[var(--color-ink-700)]">
                Sin movimientos registrados todavía
              </p>
              <p className="text-xs text-[var(--color-ink-500)]">
                Cuando edites el stock desde la grilla, se generará una entrada
                acá automáticamente.
              </p>
            </div>
          ) : (
            <ol className="divide-y divide-[var(--color-line)]">
              {ordered.map((m, idx) => (
                <MovementRow key={`${m.fecha}-${idx}`} m={m} />
              ))}
            </ol>
          )}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between border-t border-[var(--color-line)] bg-[var(--color-surface-muted)] px-5 py-3 text-xs text-[var(--color-ink-500)]">
          <span>
            {ordered.length === 0
              ? "0 movimientos"
              : `${formatNum(ordered.length)} movimiento${ordered.length === 1 ? "" : "s"}`}
          </span>
          <span className="mono">Orden: más reciente primero</span>
        </footer>
      </aside>
    </div>
  );
}

function MovementRow({ m }: { m: Movimiento }) {
  const s = TYPE_STYLE[m.tipo];
  const sign = m.cantidad > 0 ? "+" : "";
  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <span
        aria-hidden="true"
        className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-sm border"
        style={{ color: s.fg, borderColor: s.border, backgroundColor: s.bg }}
      >
        {s.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className="mono text-[11px] font-medium uppercase tracking-[0.04em]"
            style={{ color: s.fg }}
          >
            {s.label}
          </span>
          <span className="mono text-sm font-semibold text-[var(--color-ink-900)]">
            {sign}
            {formatNum(Math.abs(m.cantidad))}
          </span>
        </div>
        <p className="mt-0.5 truncate text-sm text-[var(--color-ink-700)]">
          {m.motivo || "—"}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--color-ink-500)]">
          <span className="mono">{formatFecha(m.fecha)}</span>
          <span aria-hidden="true">·</span>
          <span>{m.usuario}</span>
        </p>
      </div>
    </li>
  );
}
