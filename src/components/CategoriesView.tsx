import { useEffect, useMemo, useState } from "react";
import {
  Cube,
  Package,
  WarningOctagon,
  Warning,
  CircleNotch,
} from "@phosphor-icons/react";
import type { Product } from "../data/seed";
import {
  categoryMetrics,
  formatArs,
  formatNum,
  formatPct,
  statusLabel,
  statusOf,
} from "../lib/inventory";
import { loadProducts } from "../lib/storage";

// ---------------------------------------------------------------------------
// CategoriesView — métricas por categoría + grilla de productos.
// ---------------------------------------------------------------------------

export default function CategoriesView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    setProducts(loadProducts());
    setHydrated(true);
    if (typeof window !== "undefined" && window.location.hash) {
      const slug = decodeURIComponent(window.location.hash.slice(1)).toLowerCase();
      const found = loadProducts().find((p) => p.categoria.toLowerCase() === slug);
      if (found) setActive(found.categoria);
    }
  }, []);

  const rows = useMemo(() => categoryMetrics(products), [products]);
  const total = products.reduce((acc, p) => acc + p.stockActual * p.precioUnitario, 0);

  if (!hydrated) {
    return (
      <div className="grid place-items-center py-20 text-[var(--color-ink-500)]">
        <CircleNotch size={20} weight="bold" className="animate-spin" aria-hidden="true" />
      </div>
    );
  }

  const productsInActive = active ? products.filter((p) => p.categoria === active) : [];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <p className="eyebrow">Vista por categoría</p>
        <h1 className="text-[22px] font-semibold tracking-tight">Categorías</h1>
        <p className="text-[13px] text-[var(--color-ink-500)]">
          Distribución de productos, stock y valor por categoría. Click en una
          tarjeta para ver los productos.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => {
          const isActive = active === r.categoria;
          return (
            <button
              type="button"
              key={r.categoria}
              id={r.categoria.toLowerCase()}
              onClick={() => setActive(isActive ? null : r.categoria)}
              className={`kpi-tile flex flex-col gap-3 rounded-md border p-4 text-left ${
                isActive
                  ? "border-[var(--color-ocean)] bg-[var(--color-ocean-soft)]"
                  : "border-[var(--color-line)] bg-[var(--color-surface)] hover:border-[var(--color-ink-300)]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Cube
                    size={14}
                    weight="bold"
                    aria-hidden="true"
                    className="text-[var(--color-ocean)]"
                  />
                  <span className="text-[14px] font-semibold">{r.categoria}</span>
                </span>
                <span className="mono text-[11px] text-[var(--color-ink-500)]">
                  {r.productos} SKU
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Mini label="Stock" value={formatNum(r.stockTotal)} />
                <Mini label="Valor" value={formatArs(r.valor)} />
                <Mini label="% inv." value={formatPct(r.pctValor / 100)} />
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 text-[var(--color-ink-500)]">
                  {r.criticoCount > 0 ? (
                    <span
                      className="mono inline-flex items-center gap-1 rounded-sm border border-[color-mix(in_oklch,var(--color-status-bad)_40%,transparent)] bg-[color-mix(in_oklch,var(--color-status-bad)_10%,transparent)] px-1.5 py-0.5 font-medium uppercase tracking-[0.04em] text-[var(--color-status-bad)]"
                    >
                      <WarningOctagon size={10} weight="bold" aria-hidden="true" />
                      {r.criticoCount} crítico
                    </span>
                  ) : null}
                  {r.bajoCount > 0 ? (
                    <span
                      className="mono inline-flex items-center gap-1 rounded-sm border border-[color-mix(in_oklch,var(--color-alert)_45%,transparent)] bg-[color-mix(in_oklch,var(--color-alert)_12%,transparent)] px-1.5 py-0.5 font-medium uppercase tracking-[0.04em] text-[var(--color-alert)]"
                    >
                      <Warning size={10} weight="bold" aria-hidden="true" />
                      {r.bajoCount} bajo
                    </span>
                  ) : null}
                  {r.criticoCount === 0 && r.bajoCount === 0 ? (
                    <span className="text-[var(--color-ink-500)]">Sin alertas</span>
                  ) : null}
                </span>
                <span className="mono text-[var(--color-ink-500)]">
                  {formatArs(r.valor)}
                </span>
              </div>

              {/* Barra de proporción del valor */}
              <div className="stock-bar" aria-hidden="true">
                <span
                  className="stock-bar-fill"
                  data-status="ok"
                  style={{ width: `${Math.min(100, r.pctValor)}%`, backgroundColor: "var(--color-ocean)" }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {active ? (
        <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)]">
          <header className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-2.5">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold">
              <Package size={14} weight="bold" aria-hidden="true" className="text-[var(--color-ocean)]" />
              Productos en {active}
            </h2>
            <button
              type="button"
              onClick={() => setActive(null)}
              className="text-[11px] text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]"
            >
              Cerrar
            </button>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] bg-[var(--color-surface-muted)] text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-ink-500)]">
                  <th className="px-3 py-2 font-medium">SKU</th>
                  <th className="px-3 py-2 font-medium">Producto</th>
                  <th className="px-3 py-2 text-right font-medium">Stock</th>
                  <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Mín.</th>
                  <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Precio</th>
                  <th className="px-3 py-2 text-right font-medium">Valor</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {productsInActive.map((p) => {
                  const s = statusOf(p);
                  return (
                    <tr
                      key={p.sku}
                      className="dense-row border-b border-[var(--color-line)] hover:bg-[var(--color-surface-muted)]"
                    >
                      <td className="px-3 py-2">
                        <a
                          href={`/producto/${encodeURIComponent(p.sku)}`}
                          className="mono text-[12px] text-[var(--color-ocean)] hover:underline"
                        >
                          {p.sku}
                        </a>
                      </td>
                      <td className="px-3 py-2 text-[var(--color-ink-700)]">
                        <a href={`/producto/${encodeURIComponent(p.sku)}`} className="hover:text-[var(--color-ocean)]">
                          {p.nombre}
                        </a>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="mono text-[12.5px] text-[var(--color-ink-900)]">
                          {formatNum(p.stockActual)}
                          <span className="ml-1 font-sans text-[11px] text-[var(--color-ink-500)]">
                            {p.unidad}
                          </span>
                        </span>
                      </td>
                      <td className="hidden px-3 py-2 text-right mono text-[12px] text-[var(--color-ink-700)] sm:table-cell">
                        {formatNum(p.stockMinimo)} {p.unidad}
                      </td>
                      <td className="hidden px-3 py-2 text-right mono text-[12px] text-[var(--color-ink-700)] sm:table-cell">
                        {formatArs(p.precioUnitario)}
                      </td>
                      <td className="px-3 py-2 text-right mono text-[12.5px] text-[var(--color-ink-900)]">
                        {formatArs(p.stockActual * p.precioUnitario)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="mono inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.04em]"
                          style={{
                            color:
                              s === "ok"
                                ? "var(--color-status-ok)"
                                : s === "bajo"
                                  ? "var(--color-alert)"
                                  : "var(--color-status-bad)",
                            borderColor:
                              s === "ok"
                                ? "color-mix(in oklch, var(--color-status-ok) 38%, transparent)"
                                : s === "bajo"
                                  ? "color-mix(in oklch, var(--color-alert) 45%, transparent)"
                                  : "color-mix(in oklch, var(--color-status-bad) 48%, transparent)",
                            backgroundColor:
                              s === "ok"
                                ? "color-mix(in oklch, var(--color-status-ok) 14%, transparent)"
                                : s === "bajo"
                                  ? "color-mix(in oklch, var(--color-alert) 16%, transparent)"
                                  : "color-mix(in oklch, var(--color-status-bad) 16%, transparent)",
                          }}
                        >
                          {statusLabel(s)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <p className="text-[11px] text-[var(--color-ink-500)]">
        Total acumulado del inventario:{" "}
        <span className="mono font-medium text-[var(--color-ink-900)]">
          {formatArs(total)}
        </span>{" "}
        sobre {products.length} productos en {rows.length} categorías.
      </p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--color-ink-500)]">
        {label}
      </p>
      <p className="mono mt-0.5 text-[13px] font-semibold leading-tight text-[var(--color-ink-900)]">
        {value}
      </p>
    </div>
  );
}
