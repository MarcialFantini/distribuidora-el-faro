import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowsClockwise,
  MinusCircle,
  Package,
  Warning,
  WarningOctagon,
} from "@phosphor-icons/react";
import type { Product } from "../data/seed";
import { formatNum } from "../lib/inventory";

// ---------------------------------------------------------------------------
// AlertsBanner
//
// Auto-detecta tres tipos de alerta a partir del estado actual del
// inventario. NO requiere configuración manual del usuario:
//
//   - crítico    stock == 0                      → rojo
//   - bajo       stock <= stockMinimo (y > 0)   → ámbar
//   - sobrestock stock > stockMinimo * MULTIPLIER → océano (informativo)
//
// El umbral de sobrestock es configurable (default 5x) por si el
// depósito tiene espacio limitado y quiere disparar aviso temprano.
//
// Las alertas se ordenan por severidad (crítico > bajo > sobrestock).
// Se muestran las primeras 5; si hay más, aparece un toggle "Ver todas".
//
// Props:
//   products      lista actual
//   onSelectProduct(sku)  callback al hacer click → filtra la tabla
// ---------------------------------------------------------------------------

const SOBRESTOCK_MULTIPLIER = 5;
const VISIBLE_DEFAULT = 5;

type AlertKind = "critico" | "bajo" | "sobrestock";

interface AlertItem {
  kind: AlertKind;
  product: Product;
  message: string;
}

function deriveAlerts(products: Product[]): AlertItem[] {
  const items: AlertItem[] = [];
  for (const p of products) {
    if (p.stockMinimo > 0) {
      if (p.stockActual === 0) {
        items.push({
          kind: "critico",
          product: p,
          message: "Sin stock. Reposición urgente.",
        });
      } else if (p.stockActual <= p.stockMinimo) {
        const faltan = p.stockMinimo - p.stockActual;
        items.push({
          kind: "bajo",
          product: p,
          message: `Faltan ${formatNum(faltan)} ${p.unidad} para alcanzar el mínimo.`,
        });
      } else if (p.stockActual > p.stockMinimo * SOBRESTOCK_MULTIPLIER) {
        items.push({
          kind: "sobrestock",
          product: p,
          message: `Stock ${(p.stockActual / p.stockMinimo).toFixed(1)}× por encima del mínimo.`,
        });
      }
    } else if (p.stockActual === 0) {
      // Producto sin umbral definido pero en cero — vale avisar.
      items.push({
        kind: "critico",
        product: p,
        message: "Sin stock (umbral no definido).",
      });
    }
  }
  const rank: Record<AlertKind, number> = { critico: 0, bajo: 1, sobrestock: 2 };
  items.sort((a, b) => rank[a.kind] - rank[b.kind]);
  return items;
}

const KIND_STYLE: Record<
  AlertKind,
  {
    icon: React.ReactNode;
    iconColor: string;
    accent: string;
    bg: string;
    border: string;
    label: string;
  }
> = {
  critico: {
    icon: <WarningOctagon size={14} weight="bold" aria-hidden="true" />,
    iconColor: "var(--color-status-bad)",
    accent: "text-[var(--color-status-bad)]",
    bg: "color-mix(in oklch, var(--color-status-bad) 8%, transparent)",
    border: "color-mix(in oklch, var(--color-status-bad) 35%, transparent)",
    label: "Crítico",
  },
  bajo: {
    icon: <Warning size={14} weight="bold" aria-hidden="true" />,
    iconColor: "var(--color-alert)",
    accent: "text-[var(--color-alert)]",
    bg: "color-mix(in oklch, var(--color-alert) 10%, transparent)",
    border: "color-mix(in oklch, var(--color-alert) 40%, transparent)",
    label: "Bajo",
  },
  sobrestock: {
    icon: <ArrowsClockwise size={14} weight="bold" aria-hidden="true" />,
    iconColor: "var(--color-ocean)",
    accent: "text-[var(--color-ocean)]",
    bg: "color-mix(in oklch, var(--color-ocean) 8%, transparent)",
    border: "color-mix(in oklch, var(--color-ocean) 32%, transparent)",
    label: "Sobrestock",
  },
};

interface Props {
  products: Product[];
  onSelectProduct: (sku: string) => void;
}

export default function AlertsBanner({ products, onSelectProduct }: Props) {
  const [expanded, setExpanded] = useState(false);
  const alerts = useMemo(() => deriveAlerts(products), [products]);

  if (alerts.length === 0) return null;

  const visible = expanded ? alerts : alerts.slice(0, VISIBLE_DEFAULT);
  const hidden = Math.max(0, alerts.length - VISIBLE_DEFAULT);

  // Counts por severidad — útil para el header del banner
  const critCount = alerts.filter((a) => a.kind === "critico").length;
  const bajoCount = alerts.filter((a) => a.kind === "bajo").length;
  const sobreCount = alerts.filter((a) => a.kind === "sobrestock").length;

  return (
    <section
      aria-label="Alertas activas"
      className="overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)]"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-line)] bg-[var(--color-surface-muted)] px-3 py-2 sm:px-4">
        <div className="flex items-center gap-2">
          <span className="eyebrow">Alertas activas</span>
          <span className="mono text-[11px] text-[var(--color-ink-500)]">
            {formatNum(alerts.length)}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-[var(--color-ink-500)]">
          {critCount > 0 ? (
            <span className="inline-flex items-center gap-1">
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: "var(--color-status-bad)" }}
              />
              <span className="mono">{formatNum(critCount)} críticos</span>
            </span>
          ) : null}
          {bajoCount > 0 ? (
            <span className="inline-flex items-center gap-1">
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: "var(--color-alert)" }}
              />
              <span className="mono">{formatNum(bajoCount)} bajos</span>
            </span>
          ) : null}
          {sobreCount > 0 ? (
            <span className="inline-flex items-center gap-1">
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: "var(--color-ocean)" }}
              />
              <span className="mono">{formatNum(sobreCount)} sobrestock</span>
            </span>
          ) : null}
        </div>
      </header>

      <ul className="divide-y divide-[var(--color-line)]">
        {visible.map((a) => {
          const s = KIND_STYLE[a.kind];
          return (
            <li
              key={`${a.kind}-${a.product.sku}`}
              className="flex items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4"
              style={{ backgroundColor: s.bg }}
            >
              <span
                aria-hidden="true"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-sm border"
                style={{ color: s.iconColor, borderColor: s.border }}
              >
                {s.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm">
                  <span
                    className={`mono text-[10.5px] font-medium uppercase tracking-[0.04em] ${s.accent}`}
                  >
                    {s.label}
                  </span>
                  <span className="truncate font-medium text-[var(--color-ink-900)]">
                    {a.product.nombre}
                  </span>
                  <span className="mono hidden text-[11px] text-[var(--color-ink-500)] sm:inline">
                    {a.product.sku}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-ink-700)]">
                  {a.message}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="mono hidden text-xs text-[var(--color-ink-500)] sm:inline">
                  Stock{" "}
                  <span className="font-semibold text-[var(--color-ink-900)]">
                    {formatNum(a.product.stockActual)}
                  </span>
                  / mín{" "}
                  <span className="font-semibold text-[var(--color-ink-900)]">
                    {formatNum(a.product.stockMinimo)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onSelectProduct(a.product.sku)}
                  className="btn-base h-7 border border-[var(--color-line)] bg-[var(--color-surface)] px-2 text-[11px] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink-900)]"
                  title="Filtrar la tabla por este producto"
                >
                  <Package size={11} weight="bold" aria-hidden="true" />
                  Ver
                </button>
                {a.kind !== "sobrestock" ? (
                  <button
                    type="button"
                    onClick={() => onSelectProduct(a.product.sku)}
                    className={`btn-base h-7 px-2 text-[11px] font-medium text-white ${s.accent.replace("text-", "bg-")}`}
                    style={{
                      backgroundColor: s.iconColor,
                    }}
                    title="Marcar para reposición"
                  >
                    <ArrowRight size={11} weight="bold" aria-hidden="true" />
                    Reponer
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {hidden > 0 ? (
        <div className="flex items-center justify-between gap-2 border-t border-[var(--color-line)] bg-[var(--color-surface-muted)] px-3 py-2 text-xs sm:px-4">
          <span className="text-[var(--color-ink-700)]">
            <span className="mono font-semibold text-[var(--color-ink-900)]">
              +{formatNum(hidden)}
            </span>{" "}
            alerta{hidden === 1 ? "" : "s"} más
          </span>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="btn-base inline-flex items-center gap-1 text-xs text-[var(--color-ocean)] hover:underline"
          >
            {expanded ? (
              <>
                <MinusCircle size={12} weight="bold" aria-hidden="true" />
                Ver menos
              </>
            ) : (
              <>
                <PlusIcon />
                Ver todas
              </>
            )}
          </button>
        </div>
      ) : null}
    </section>
  );
}

// Pequeño plus inline para no traer más iconos.
function PlusIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <path d="M6 1.5v9M1.5 6h9" />
    </svg>
  );
}
