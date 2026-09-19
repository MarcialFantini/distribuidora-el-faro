import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChartBar,
  CircleNotch,
  Coins,
  Cube,
  FilePdf,
  WarningOctagon,
} from "@phosphor-icons/react";
import type { Product } from "../data/seed";
import {
  categoryMetrics,
  formatArs,
  formatNum,
  formatNumDec,
  projectRotation,
  statusLabel,
  statusOf,
} from "../lib/inventory";
import { loadProducts } from "../lib/storage";
import DataTable, { type Column } from "./DataTable";
import {
  downloadStockCriticoPdf,
  downloadValorizacionPdf,
  downloadRotacionPdf,
  type JsPdfCtor,
  type AutoTableMod,
} from "../lib/pdf";

// ---------------------------------------------------------------------------
// ReportsView — sub-tabs: stock crítico | valorización | rotación.
// ---------------------------------------------------------------------------

type Tab = "critico" | "valor" | "rotacion";

const TABS: { value: Tab; label: string; icon: React.ReactNode; desc: string }[] = [
  {
    value: "critico",
    label: "Stock crítico",
    icon: <WarningOctagon size={14} weight="bold" aria-hidden="true" />,
    desc: "Productos en estado bajo o crítico, ordenados por urgencia.",
  },
  {
    value: "valor",
    label: "Valorización",
    icon: <Coins size={14} weight="bold" aria-hidden="true" />,
    desc: "Valor de inventario por categoría y total acumulado.",
  },
  {
    value: "rotacion",
    label: "Proyección de rotación",
    icon: <ChartBar size={14} weight="bold" aria-hidden="true" />,
    desc: "Días de stock restantes según promedio de salidas 30d.",
  },
];

interface StockCriticoRow {
  sku: string;
  nombre: string;
  categoria: string;
  stockActual: number;
  stockMinimo: number;
  unidad: string;
  faltan: number;
  pctDelMinimo: number;
  estado: "bajo" | "critico";
}

export default function ReportsView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<Tab>("critico");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setProducts(loadProducts());
    setHydrated(true);
  }, []);

  const criticoRows = useMemo<StockCriticoRow[]>(() => {
    const rows: StockCriticoRow[] = [];
    for (const p of products) {
      const s = statusOf(p);
      if (s === "ok" || p.stockMinimo <= 0) continue;
      rows.push({
        sku: p.sku,
        nombre: p.nombre,
        categoria: p.categoria,
        stockActual: p.stockActual,
        stockMinimo: p.stockMinimo,
        unidad: p.unidad,
        faltan: Math.max(0, p.stockMinimo - p.stockActual),
        pctDelMinimo:
          p.stockMinimo > 0 ? (p.stockActual / p.stockMinimo) * 100 : 100,
        estado: s,
      });
    }
    rows.sort((a, b) => a.pctDelMinimo - b.pctDelMinimo);
    return rows;
  }, [products]);

  const valorRows = useMemo(() => categoryMetrics(products), [products]);
  const totalValor = valorRows.reduce((acc, r) => acc + r.valor, 0);

  const rotacionRows = useMemo(() => projectRotation(products), [products]);

  const onExport = useCallback(async () => {
    setExporting(true);
    try {
      // jspdf import dinámico para evitar SSR/edge issues.
      const [{ jsPDF }, autoTableMod] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable").catch(() => null),
      ]);
      // La clase real de jspdf tiene overloads en setFont/etc. que difieren
      // ligeramente de nuestra interface local. Hacemos cast explícito: la
      // superficie que usamos está verificada en runtime.
      const JsPDF = jsPDF as unknown as JsPdfCtor;
      if (tab === "critico") {
        downloadStockCriticoPdf(JsPDF, autoTableMod as unknown as AutoTableMod | null, criticoRows);
      } else if (tab === "valor") {
        downloadValorizacionPdf(JsPDF, autoTableMod as unknown as AutoTableMod | null, valorRows, totalValor);
      } else {
        downloadRotacionPdf(JsPDF, autoTableMod as unknown as AutoTableMod | null, rotacionRows);
      }
    } catch (err) {
      console.error("Export PDF failed", err);
    } finally {
      setExporting(false);
    }
  }, [tab, criticoRows, valorRows, rotacionRows, totalValor]);

  const columnsCritico: Column<StockCriticoRow>[] = [
    {
      key: "estado",
      header: "Estado",
      width: "9%",
      sortBy: (r) => r.estado,
      render: (r) => (
        <span
          className="mono inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.04em]"
          style={
            r.estado === "critico"
              ? {
                  color: "var(--color-status-bad)",
                  backgroundColor: "color-mix(in oklch, var(--color-status-bad) 14%, transparent)",
                  borderColor: "color-mix(in oklch, var(--color-status-bad) 38%, transparent)",
                }
              : {
                  color: "var(--color-alert)",
                  backgroundColor: "color-mix(in oklch, var(--color-alert) 14%, transparent)",
                  borderColor: "color-mix(in oklch, var(--color-alert) 45%, transparent)",
                }
          }
        >
          {statusLabel(r.estado)}
        </span>
      ),
    },
    {
      key: "sku",
      header: "SKU",
      width: "12%",
      sortBy: (r) => r.sku,
      render: (r) => (
        <a
          href={`/producto/${encodeURIComponent(r.sku)}`}
          className="mono text-[12px] text-[var(--color-ocean)] hover:underline"
        >
          {r.sku}
        </a>
      ),
    },
    {
      key: "nombre",
      header: "Producto",
      sortBy: (r) => r.nombre,
      render: (r) => <span className="text-[12.5px]">{r.nombre}</span>,
    },
    {
      key: "categoria",
      header: "Categoría",
      width: "10%",
      showOnMobile: false,
      sortBy: (r) => r.categoria,
      render: (r) => (
        <span className="text-[12.5px] text-[var(--color-ink-700)]">{r.categoria}</span>
      ),
    },
    {
      key: "stockActual",
      header: "Stock",
      align: "right",
      width: "10%",
      sortBy: (r) => r.stockActual,
      render: (r) => (
        <span className="mono text-[12.5px] text-[var(--color-ink-900)]">
          {formatNum(r.stockActual)} {r.unidad}
        </span>
      ),
    },
    {
      key: "faltan",
      header: "Faltan",
      align: "right",
      width: "10%",
      sortBy: (r) => r.faltan,
      render: (r) => (
        <span className="mono text-[12.5px] text-[var(--color-status-bad)]">
          {formatNum(r.faltan)} {r.unidad}
        </span>
      ),
    },
    {
      key: "pctDelMinimo",
      header: "% del mín.",
      align: "right",
      width: "12%",
      sortBy: (r) => r.pctDelMinimo,
      render: (r) => (
        <div className="flex items-center justify-end gap-2">
          <span className="mono text-[12px] text-[var(--color-ink-700)]">
            {r.pctDelMinimo.toFixed(0)}%
          </span>
          <div className="stock-bar w-16" aria-hidden="true">
            <span
              className="stock-bar-fill"
              data-status={r.estado === "critico" ? "critico" : "bajo"}
              style={{ width: `${Math.min(100, r.pctDelMinimo)}%` }}
            />
          </div>
        </div>
      ),
    },
  ];

  const columnsValor: Column<(typeof valorRows)[number]>[] = [
    {
      key: "categoria",
      header: "Categoría",
      sortBy: (r) => r.categoria,
      render: (r) => (
        <span className="inline-flex items-center gap-1.5">
          <Cube size={11} weight="bold" aria-hidden="true" className="text-[var(--color-ocean)]" />
          <span className="text-[12.5px] font-medium">{r.categoria}</span>
        </span>
      ),
    },
    {
      key: "productos",
      header: "Productos",
      align: "right",
      width: "12%",
      sortBy: (r) => r.productos,
      render: (r) => (
        <span className="mono text-[12.5px]">{formatNum(r.productos)}</span>
      ),
    },
    {
      key: "stockTotal",
      header: "Stock total",
      align: "right",
      width: "14%",
      sortBy: (r) => r.stockTotal,
      render: (r) => (
        <span className="mono text-[12.5px]">{formatNum(r.stockTotal)}</span>
      ),
    },
    {
      key: "criticoCount",
      header: "Alertas",
      align: "center",
      width: "12%",
      sortBy: (r) => r.criticoCount + r.bajoCount,
      render: (r) => (
        <span className="mono text-[12px]">
          {r.criticoCount > 0 ? (
            <span className="mr-1 text-[var(--color-status-bad)]">
              {r.criticoCount}c
            </span>
          ) : null}
          {r.bajoCount > 0 ? (
            <span className="text-[var(--color-alert)]">{r.bajoCount}b</span>
          ) : (
            <span className="text-[var(--color-ink-500)]">0</span>
          )}
        </span>
      ),
    },
    {
      key: "valor",
      header: "Valor",
      align: "right",
      width: "16%",
      sortBy: (r) => r.valor,
      render: (r) => (
        <span className="mono text-[12.5px] font-medium">{formatArs(r.valor)}</span>
      ),
    },
    {
      key: "pctValor",
      header: "% del total",
      align: "right",
      width: "18%",
      sortBy: (r) => r.pctValor,
      render: (r) => (
        <div className="flex items-center justify-end gap-2">
          <span className="mono text-[12px] text-[var(--color-ink-700)]">
            {r.pctValor.toFixed(1)}%
          </span>
          <div className="stock-bar w-20" aria-hidden="true">
            <span
              className="stock-bar-fill"
              data-status="ok"
              style={{
                width: `${Math.min(100, r.pctValor)}%`,
                backgroundColor: "var(--color-ocean)",
              }}
            />
          </div>
        </div>
      ),
    },
  ];

  type RotRow = (typeof rotacionRows)[number];
  const columnsRotacion: Column<RotRow>[] = [
    {
      key: "estado",
      header: "Estado",
      width: "10%",
      sortBy: (r) => r.diasRestantes ?? Number.MAX_SAFE_INTEGER,
      render: (r) => {
        if (r.estado === "sin_ventas")
          return (
            <span className="mono text-[10.5px] uppercase tracking-[0.04em] text-[var(--color-ink-500)]">
              Sin ventas
            </span>
          );
        if (r.estado === "critico")
          return (
            <span
              className="mono inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.04em]"
              style={{
                color: "var(--color-status-bad)",
                backgroundColor: "color-mix(in oklch, var(--color-status-bad) 14%, transparent)",
                borderColor: "color-mix(in oklch, var(--color-status-bad) 38%, transparent)",
              }}
            >
              Crítico
            </span>
          );
        if (r.estado === "alerta")
          return (
            <span
              className="mono inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.04em]"
              style={{
                color: "var(--color-alert)",
                backgroundColor: "color-mix(in oklch, var(--color-alert) 14%, transparent)",
                borderColor: "color-mix(in oklch, var(--color-alert) 45%, transparent)",
              }}
            >
              Alerta
            </span>
          );
        return (
          <span
            className="mono inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.04em]"
            style={{
              color: "var(--color-status-ok)",
              backgroundColor: "color-mix(in oklch, var(--color-status-ok) 14%, transparent)",
              borderColor: "color-mix(in oklch, var(--color-status-ok) 38%, transparent)",
            }}
          >
            OK
          </span>
        );
      },
    },
    {
      key: "sku",
      header: "SKU",
      width: "12%",
      sortBy: (r) => r.sku,
      render: (r) => (
        <a
          href={`/producto/${encodeURIComponent(r.sku)}`}
          className="mono text-[12px] text-[var(--color-ocean)] hover:underline"
        >
          {r.sku}
        </a>
      ),
    },
    {
      key: "nombre",
      header: "Producto",
      sortBy: (r) => r.nombre,
      render: (r) => <span className="text-[12.5px]">{r.nombre}</span>,
    },
    {
      key: "stockActual",
      header: "Stock",
      align: "right",
      width: "10%",
      sortBy: (r) => r.stockActual,
      render: (r) => (
        <span className="mono text-[12.5px]">
          {formatNum(r.stockActual)} {r.unidad}
        </span>
      ),
    },
    {
      key: "ventas30d",
      header: "Ventas 30d",
      align: "right",
      width: "12%",
      sortBy: (r) => r.ventas30d,
      render: (r) => (
        <span className="mono text-[12.5px] text-[var(--color-ink-700)]">
          {formatNum(r.ventas30d)} {r.unidad}
        </span>
      ),
    },
    {
      key: "promedioDiario",
      header: "Prom./día",
      align: "right",
      width: "10%",
      showOnMobile: false,
      sortBy: (r) => r.promedioDiario,
      render: (r) => (
        <span className="mono text-[12px] text-[var(--color-ink-700)]">
          {formatNumDec(r.promedioDiario)}
        </span>
      ),
    },
    {
      key: "diasRestantes",
      header: "Días restantes",
      align: "right",
      width: "14%",
      sortBy: (r) => r.diasRestantes ?? Number.MAX_SAFE_INTEGER,
      render: (r) =>
        r.diasRestantes === null ? (
          <span className="mono text-[12px] text-[var(--color-ink-500)]">—</span>
        ) : (
          <span
            className={`mono text-[13px] font-medium ${
              r.diasRestantes <= 7
                ? "text-[var(--color-status-bad)]"
                : r.diasRestantes <= 14
                  ? "text-[var(--color-alert)]"
                  : "text-[var(--color-ink-900)]"
            }`}
          >
            {formatNum(r.diasRestantes)} días
          </span>
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
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Reportes operativos</p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-tight">Reportes</h1>
          <p className="text-[13px] text-[var(--color-ink-500)]">
            Tres vistas priorizadas para la toma de decisiones.
          </p>
        </div>
        <button
          type="button"
          onClick={onExport}
          disabled={exporting}
          className="btn-base h-9 bg-[var(--color-ocean)] px-3 text-[12.5px] font-medium text-white hover:bg-[var(--color-ocean-deep)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {exporting ? (
            <CircleNotch size={14} weight="bold" className="animate-spin" aria-hidden="true" />
          ) : (
            <FilePdf size={14} weight="bold" aria-hidden="true" />
          )}
          {exporting ? "Generando…" : "Exportar PDF"}
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--color-line)]">
        {TABS.map((t) => (
          <button
            type="button"
            key={t.value}
            onClick={() => setTab(t.value)}
            aria-current={tab === t.value ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[12.5px] transition-colors ${
              tab === t.value
                ? "border-[var(--color-ocean)] text-[var(--color-ocean)]"
                : "border-transparent text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <p className="text-[12.5px] text-[var(--color-ink-500)]">
        {TABS.find((t) => t.value === tab)?.desc}
      </p>

      {tab === "critico" ? (
        <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
          <DataTable
            columns={columnsCritico}
            rows={criticoRows}
            pageSize={15}
            initialSort={{ key: "pctDelMinimo", dir: "asc" }}
            tableId="critico"
            totalLabel="productos"
            emptyMessage="No hay productos en estado crítico o bajo."
          />
        </section>
      ) : null}

      {tab === "valor" ? (
        <section className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard
              label="Valor total"
              value={formatArs(totalValor)}
              hint={`${products.length} productos en ${valorRows.length} categorías`}
            />
            <KpiCard
              label="Categoría top"
              value={valorRows[0]?.categoria ?? "—"}
              hint={
                valorRows[0]
                  ? `${formatArs(valorRows[0].valor)} · ${valorRows[0].pctValor.toFixed(1)}%`
                  : "—"
              }
            />
            <KpiCard
              label="Con alertas"
              value={valorRows
                .reduce((acc, r) => acc + r.criticoCount + r.bajoCount, 0)
                .toLocaleString("es-AR")}
              hint="productos bajo o crítico"
            />
          </div>
          <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
            <DataTable
              columns={columnsValor}
              rows={valorRows}
              pageSize={20}
              initialSort={{ key: "valor", dir: "desc" }}
              tableId="valor"
              totalLabel="categorías"
            />
          </section>
        </section>
      ) : null}

      {tab === "rotacion" ? (
        <section className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard
              label="Críticos (≤7 días)"
              value={rotacionRows
                .filter((r) => r.estado === "critico")
                .length.toLocaleString("es-AR")}
              hint="reposición inmediata"
            />
            <KpiCard
              label="En alerta (≤14 días)"
              value={rotacionRows
                .filter((r) => r.estado === "alerta")
                .length.toLocaleString("es-AR")}
              hint="reponer esta semana"
            />
            <KpiCard
              label="Sin ventas 30d"
              value={rotacionRows
                .filter((r) => r.estado === "sin_ventas")
                .length.toLocaleString("es-AR")}
              hint="revisar si corresponde discontinuar"
            />
          </div>
          <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
            <DataTable
              columns={columnsRotacion}
              rows={rotacionRows}
              pageSize={15}
              initialSort={{ key: "diasRestantes", dir: "asc" }}
              tableId="rotacion"
              totalLabel="productos"
            />
          </section>
        </section>
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="kpi-tile rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--color-ink-500)]">
        {label}
      </p>
      <p className="mono mt-1 text-[18px] font-semibold leading-tight text-[var(--color-ink-900)]">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[11px] text-[var(--color-ink-500)]">{hint}</p>
      ) : null}
    </div>
  );
}
