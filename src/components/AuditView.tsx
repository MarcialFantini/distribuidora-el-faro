import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowsClockwise,
  CheckCircle,
  CircleNotch,
  FileCsv,
  PencilSimple,
  Plus,
  TrashSimple,
  WarningOctagon,
} from "@phosphor-icons/react";
import type { AuditEntry, Operario } from "../data/seed";
import { formatNum } from "../lib/inventory";
import { loadAudit, loadOperarios } from "../lib/storage";
import DataTable, { type Column } from "./DataTable";

// ---------------------------------------------------------------------------
// AuditView — log cronológico de operaciones relevantes.
// ---------------------------------------------------------------------------

const ACCION_LABELS: Record<AuditEntry["accion"], string> = {
  alta_producto: "Alta producto",
  edicion_producto: "Edición producto",
  eliminacion_producto: "Eliminación producto",
  ajuste_stock: "Ajuste de stock",
  stock_adjust: "Ajuste rápido",
  stock_set: "Stock fijado",
  stock_reset: "Reset catálogo",
  movimiento_manual: "Movimiento manual",
  importacion_csv: "Importación CSV",
  orden_compra_creada: "OC creada",
  orden_compra_recibida: "OC recibida",
  reset_catalogo: "Reset catálogo",
};

const ACCION_TONE: Record<AuditEntry["accion"], { fg: string; bg: string; border: string }> = {
  alta_producto: {
    fg: "var(--color-status-ok)",
    bg: "color-mix(in oklch, var(--color-status-ok) 14%, transparent)",
    border: "color-mix(in oklch, var(--color-status-ok) 38%, transparent)",
  },
  edicion_producto: {
    fg: "var(--color-ocean)",
    bg: "var(--color-ocean-soft)",
    border: "color-mix(in oklch, var(--color-ocean) 38%, transparent)",
  },
  eliminacion_producto: {
    fg: "var(--color-status-bad)",
    bg: "color-mix(in oklch, var(--color-status-bad) 14%, transparent)",
    border: "color-mix(in oklch, var(--color-status-bad) 38%, transparent)",
  },
ajuste_stock: {
    fg: "var(--color-alert)",
    bg: "color-mix(in oklch, var(--color-alert) 14%, transparent)",
    border: "color-mix(in oklch, var(--color-alert) 45%, transparent)",
  },
  stock_adjust: {
    fg: "var(--color-ocean)",
    bg: "var(--color-ocean-soft)",
    border: "color-mix(in oklch, var(--color-ocean) 38%, transparent)",
  },
  stock_set: {
    fg: "var(--color-ink-700)",
    bg: "color-mix(in oklch, var(--color-ink-700) 10%, transparent)",
    border: "color-mix(in oklch, var(--color-ink-700) 30%, transparent)",
  },
  stock_reset: {
    fg: "var(--color-status-bad)",
    bg: "color-mix(in oklch, var(--color-status-bad) 14%, transparent)",
    border: "color-mix(in oklch, var(--color-status-bad) 38%, transparent)",
  },
  movimiento_manual: {
    fg: "var(--color-ink-700)",
    bg: "color-mix(in oklch, var(--color-ink-700) 10%, transparent)",
    border: "color-mix(in oklch, var(--color-ink-700) 30%, transparent)",
  },
  importacion_csv: {
    fg: "var(--color-ocean)",
    bg: "var(--color-ocean-soft)",
    border: "color-mix(in oklch, var(--color-ocean) 38%, transparent)",
  },
  orden_compra_creada: {
    fg: "var(--color-status-ok)",
    bg: "color-mix(in oklch, var(--color-status-ok) 14%, transparent)",
    border: "color-mix(in oklch, var(--color-status-ok) 38%, transparent)",
  },
  orden_compra_recibida: {
    fg: "var(--color-status-ok)",
    bg: "color-mix(in oklch, var(--color-status-ok) 14%, transparent)",
    border: "color-mix(in oklch, var(--color-status-ok) 38%, transparent)",
  },
  reset_catalogo: {
    fg: "var(--color-status-bad)",
    bg: "color-mix(in oklch, var(--color-status-bad) 14%, transparent)",
    border: "color-mix(in oklch, var(--color-status-bad) 38%, transparent)",
  },
};

export default function AuditView() {
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [operarios, setOperarios] = useState<Operario[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [filterOp, setFilterOp] = useState<string>("todos");
  const [filterAccion, setFilterAccion] = useState<string>("todas");

  useEffect(() => {
    setAudit(loadAudit());
    setOperarios(loadOperarios());
    setHydrated(true);
  }, []);

  const filtered = useMemo(() => {
    return audit.filter((a) => {
      if (filterOp !== "todos" && a.operario !== filterOp) return false;
      if (filterAccion !== "todas" && a.accion !== filterAccion) return false;
      return true;
    });
  }, [audit, filterOp, filterAccion]);

  const columns: Column<AuditEntry>[] = [
    {
      key: "fecha",
      header: "Fecha",
      width: "16%",
      sortBy: (a) => a.fecha,
      render: (a) => (
        <span className="mono text-[12px] text-[var(--color-ink-700)]">
          {new Date(a.fecha).toLocaleString("es-AR", {
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
      key: "operario",
      header: "Operario",
      width: "14%",
      sortBy: (a) => a.operario,
      render: (a) => {
        const op = operarios.find((o) => o.nombre === a.operario);
        return (
          <span className="inline-flex items-center gap-1.5">
            {op ? (
              <span
                aria-hidden="true"
                className="grid h-5 w-5 place-items-center rounded-[3px] font-mono text-[9px] font-semibold uppercase text-white"
                style={{ backgroundColor: op.color }}
              >
                {op.nombre.split(/\s+/).slice(0, 2).map((w) => w[0]).join("")}
              </span>
            ) : null}
            <span className="text-[12.5px] text-[var(--color-ink-900)]">
              {a.operario}
            </span>
          </span>
        );
      },
    },
    {
      key: "accion",
      header: "Acción",
      width: "13%",
      sortBy: (a) => a.accion,
      render: (a) => {
        const tone = ACCION_TONE[a.accion];
        return (
          <span
            className="mono inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.04em]"
            style={{
              color: tone.fg,
              backgroundColor: tone.bg,
              borderColor: tone.border,
            }}
          >
            {accionIcon(a.accion)}
            {ACCION_LABELS[a.accion]}
          </span>
        );
      },
    },
    {
      key: "detalle",
      header: "Detalle",
      sortBy: (a) => a.detalle,
      render: (a) => (
        <span className="text-[12.5px] text-[var(--color-ink-700)]">{a.detalle}</span>
      ),
    },
    {
      key: "sku",
      header: "SKU",
      width: "13%",
      showOnMobile: false,
      sortBy: (a) => a.sku ?? "",
      render: (a) =>
        a.sku ? (
          <a
            href={`/producto/${encodeURIComponent(a.sku)}`}
            className="mono text-[12px] text-[var(--color-ocean)] hover:underline"
          >
            {a.sku}
          </a>
        ) : (
          <span className="mono text-[12px] text-[var(--color-ink-500)]">—</span>
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

  const accionesUnicas = Array.from(new Set(audit.map((a) => a.accion)));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Trazabilidad</p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-tight">Auditoría</h1>
          <p className="text-[13px] text-[var(--color-ink-500)]">
            {formatNum(audit.length)} entradas registradas. Filtrá por operario o tipo.
          </p>
        </div>
      </header>

      <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Operario">
            <select
              value={filterOp}
              onChange={(e) => setFilterOp(e.target.value)}
              className="h-9 w-[200px] rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 text-[12.5px] focus:border-[var(--color-focus)] focus:outline-none"
            >
              <option value="todos">Todos los operarios</option>
              {operarios.map((o) => (
                <option key={o.id} value={o.nombre}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Acción">
            <select
              value={filterAccion}
              onChange={(e) => setFilterAccion(e.target.value)}
              className="h-9 w-[200px] rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 text-[12.5px] focus:border-[var(--color-focus)] focus:outline-none"
            >
              <option value="todas">Todas las acciones</option>
              {accionesUnicas.map((a) => (
                <option key={a} value={a}>
                  {ACCION_LABELS[a]}
                </option>
              ))}
            </select>
          </Field>
          <button
            type="button"
            onClick={() => {
              setFilterOp("todos");
              setFilterAccion("todas");
            }}
            className="btn-base ml-auto h-9 border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-[11.5px] hover:bg-[var(--color-surface-muted)]"
          >
            Limpiar filtros
          </button>
        </div>
      </section>

      <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)]">
        <div className="p-3">
          <DataTable
            columns={columns}
            rows={filtered}
            pageSize={20}
            initialSort={{ key: "fecha", dir: "desc" }}
            resetKey={`${filterOp}|${filterAccion}`}
            tableId="audit"
            totalLabel="entradas"
            emptyMessage="Sin entradas para los filtros aplicados."
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

function accionIcon(accion: AuditEntry["accion"]) {
  const props = { size: 9, weight: "bold" as const, "aria-hidden": true };
  switch (accion) {
    case "alta_producto":
      return <Plus {...props} />;
    case "edicion_producto":
      return <PencilSimple {...props} />;
    case "eliminacion_producto":
      return <TrashSimple {...props} />;
    case "ajuste_stock":
      return <ArrowUp {...props} />;
    case "stock_adjust":
      return <ArrowsClockwise {...props} />;
    case "stock_set":
      return <PencilSimple {...props} />;
    case "stock_reset":
      return <WarningOctagon {...props} />;
    case "movimiento_manual":
      return <ArrowsClockwise {...props} />;
    case "importacion_csv":
      return <FileCsv {...props} />;
    case "orden_compra_creada":
      return <Plus {...props} />;
    case "orden_compra_recibida":
      return <CheckCircle {...props} />;
    case "reset_catalogo":
      return <WarningOctagon {...props} />;
  }
}
