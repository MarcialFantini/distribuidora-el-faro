import {
  CheckCircle,
  Warning,
  WarningOctagon,
} from "@phosphor-icons/react";
import type { StockStatus } from "../data/seed";
import { statusLabel } from "../lib/inventory";

// ---------------------------------------------------------------------------
// StatusBadge compartido: ok | bajo | crítico.
// Usa los CSS variables del theme; color-mix da un fondo translúcido sin
// necesitar definir variantes light/dark explícitas.
// Mismo idioma visual que AuditView (icono + dot) para coherencia entre
// superficies.
// ---------------------------------------------------------------------------

const PALETTE = {
  ok: {
    fg: "var(--color-status-ok)",
    bg: "color-mix(in oklch, var(--color-status-ok) 14%, transparent)",
    border: "color-mix(in oklch, var(--color-status-ok) 38%, transparent)",
    label: statusLabel("ok"),
    icon: <CheckCircle size={11} weight="bold" aria-hidden="true" />,
  },
  bajo: {
    fg: "var(--color-alert)",
    bg: "color-mix(in oklch, var(--color-alert) 16%, transparent)",
    border: "color-mix(in oklch, var(--color-alert) 45%, transparent)",
    label: statusLabel("bajo"),
    icon: <Warning size={11} weight="bold" aria-hidden="true" />,
  },
  critico: {
    fg: "var(--color-status-bad)",
    bg: "color-mix(in oklch, var(--color-status-bad) 16%, transparent)",
    border: "color-mix(in oklch, var(--color-status-bad) 48%, transparent)",
    label: statusLabel("critico"),
    icon: <WarningOctagon size={11} weight="bold" aria-hidden="true" />,
  },
} as const;

export default function StatusBadge({ status }: { status: StockStatus }) {
  const p = PALETTE[status];
  return (
    <span
      className="mono inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.04em]"
      style={{ color: p.fg, backgroundColor: p.bg, borderColor: p.border }}
    >
      {p.icon}
      {p.label}
    </span>
  );
}