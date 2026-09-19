import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowsLeftRight,
  ArrowUp,
  Clock,
  Plus,
  X,
} from "@phosphor-icons/react";
import type { Movimiento, MovementType, Product } from "../data/seed";
import { formatNum } from "../lib/inventory";
import { movimientosOf } from "../lib/storage";

// MovementHistory — drawer con la lista cronológica de movimientos de un producto.
// Acepta tanto el patrón "drawer con open" (legado) como el nuevo patrón
// "siempre montado, recibe product".

interface Props {
  product: Product;
  onClose?: () => void;
  onAddMovement?: (m: { tipo: MovementType; cantidad: number; motivo: string }) => void;
}

const TYPE_STYLE: Record<MovementType, { label: string; fg: string; bg: string; border: string; icon: React.ReactNode }> = {
  entrada: {
    label: "Entrada", fg: "var(--color-status-ok)",
    bg: "color-mix(in oklch, var(--color-status-ok) 14%, transparent)",
    border: "color-mix(in oklch, var(--color-status-ok) 38%, transparent)",
    icon: <ArrowUp size={12} weight="bold" aria-hidden="true" />,
  },
  salida: {
    label: "Salida", fg: "var(--color-status-bad)",
    bg: "color-mix(in oklch, var(--color-status-bad) 14%, transparent)",
    border: "color-mix(in oklch, var(--color-status-bad) 38%, transparent)",
    icon: <ArrowDown size={12} weight="bold" aria-hidden="true" />,
  },
  ajuste: {
    label: "Ajuste", fg: "var(--color-ocean)",
    bg: "color-mix(in oklch, var(--color-ocean) 12%, transparent)",
    border: "color-mix(in oklch, var(--color-ocean) 36%, transparent)",
    icon: <ArrowsLeftRight size={12} weight="bold" aria-hidden="true" />,
  },
};

const dateFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});
function formatFecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return dateFmt.format(d);
}

export default function MovementHistory({ product, onClose, onAddMovement }: Props) {
  useEffect(() => {
    if (!onClose) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && onClose) onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const [showForm, setShowForm] = useState(false);
  const [tipo, setTipo] = useState<MovementType>("entrada");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");

  const movimientos = movimientosOf(product);
  const ordered = movimientos.slice().sort((a, b) => b.fecha.localeCompare(a.fecha));

  function submit() {
    if (!onAddMovement) return;
    const c = Number(cantidad);
    if (!Number.isFinite(c) || c === 0) return;
    const signed = tipo === "entrada" ? Math.abs(c) : -Math.abs(c);
    onAddMovement({ tipo, cantidad: signed, motivo: motivo.trim() || (tipo === "entrada" ? "Reposición" : tipo === "salida" ? "Venta" : "Ajuste") });
    setCantidad("");
    setMotivo("");
    setShowForm(false);
  }

  return (
    <div className="flex flex-col gap-3">
      {onAddMovement ? (
        <div className="flex flex-wrap items-center gap-2">
          {!showForm ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="btn-base h-8 border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 text-[12px] hover:bg-[var(--color-surface-muted)]"
            >
              <Plus size={12} weight="bold" aria-hidden="true" />
              Nuevo movimiento
            </button>
          ) : (
            <div className="flex w-full flex-col gap-2 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-muted)] p-2.5">
<div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor={`mov-tipo-${product.sku}`}>Tipo de movimiento</label>
                <select
                  id={`mov-tipo-${product.sku}`}
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as MovementType)}
                  className="h-8 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 text-[12px]"
                >
                  <option value="entrada">Entrada (+)</option>
                  <option value="salida">Salida (−)</option>
                  <option value="ajuste">Ajuste (±)</option>
                </select>
                <label className="sr-only" htmlFor={`mov-cantidad-${product.sku}`}>Cantidad</label>
                <input
                  id={`mov-cantidad-${product.sku}`}
                  type="number"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  placeholder="Cantidad"
                  className="mono h-8 w-24 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 text-right text-[12px]"
                />
                <label className="sr-only" htmlFor={`mov-motivo-${product.sku}`}>Motivo</label>
                <input
                  id={`mov-motivo-${product.sku}`}
                  type="text"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Motivo (opcional)"
                  className="h-8 flex-1 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 text-[12px]"
                />
                <button
                  type="button"
                  onClick={submit}
                  className="btn-base h-8 bg-[var(--color-ocean)] px-2.5 text-[12px] font-medium text-white hover:bg-[var(--color-ocean-deep)]"
                >
                  Registrar
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-base h-8 border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 text-[12px] hover:bg-[var(--color-surface-muted)]"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {ordered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
          <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-md border border-[var(--color-line)] bg-[var(--color-surface-muted)] text-[var(--color-ink-500)]">
            <Clock size={18} weight="bold" />
          </span>
          <p className="text-sm text-[var(--color-ink-700)]">Sin movimientos registrados todavía</p>
          <p className="text-xs text-[var(--color-ink-500)]">Cuando edites el stock desde la grilla, se generará una entrada acá automáticamente.</p>
        </div>
      ) : (
        <ol className="max-h-96 divide-y divide-[var(--color-line)] overflow-y-auto rounded-md border border-[var(--color-line)]">
          {ordered.map((m, idx) => (
            <MovementRow key={`${m.fecha}-${idx}`} m={m} />
          ))}
        </ol>
      )}

      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="btn-base mt-1 h-8 self-end border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-[12px] hover:bg-[var(--color-surface-muted)]"
        >
          <X size={12} weight="bold" aria-hidden="true" />
          Cerrar
        </button>
      ) : null}
    </div>
  );
}

function MovementRow({ m }: { m: Movimiento }) {
  const s = TYPE_STYLE[m.tipo];
  const sign = m.cantidad > 0 ? "+" : "";
  return (
    <li className="flex items-start gap-3 px-4 py-2.5">
      <span aria-hidden="true" className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-sm border" style={{ color: s.fg, borderColor: s.border, backgroundColor: s.bg }}>
        {s.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="mono text-[11px] font-medium uppercase tracking-[0.04em]" style={{ color: s.fg }}>
            {s.label}
          </span>
          <span className="mono text-sm font-semibold text-[var(--color-ink-900)]">
            {sign}{formatNum(Math.abs(m.cantidad))}
          </span>
        </div>
        <p className="mt-0.5 truncate text-sm text-[var(--color-ink-700)]">{m.motivo || "—"}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--color-ink-500)]">
          <span className="mono">{formatFecha(m.fecha)}</span>
          <span aria-hidden="true">·</span>
          <span>{m.usuario}</span>
        </p>
      </div>
</li>
  );
}
