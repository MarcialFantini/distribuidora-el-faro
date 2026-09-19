import { useEffect, useMemo, useState } from "react";
import {
  CircleNotch,
  Phone,
  Plus,
  Storefront,
  EnvelopeSimple,
} from "@phosphor-icons/react";
import type { Product, Proveedor } from "../data/seed";
import { formatArs, formatNum } from "../lib/inventory";
import {
  loadProducts,
  loadProveedores,
} from "../lib/storage";

// ---------------------------------------------------------------------------
// SuppliersView — tabla de proveedores con productos que surte + última orden.
// ---------------------------------------------------------------------------

interface Props {
  showNewButton?: boolean;
}

export default function SuppliersView({ showNewButton = true }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    setProducts(loadProducts());
    setProveedores(loadProveedores());
    setHydrated(true);
  }, []);

  const rows = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return proveedores
      .map((p) => {
        const prods = products.filter((prod) => p.skus.includes(prod.sku));
        const valorTotal = prods.reduce(
          (acc, prod) => acc + prod.stockActual * prod.precioUnitario,
          0,
        );
        return { proveedor: p, productos: prods, valorTotal };
      })
      .filter((r) =>
        f.length === 0
          ? true
          : `${r.proveedor.nombre} ${r.proveedor.contacto}`.toLowerCase().includes(f),
      );
  }, [proveedores, products, filter]);

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
          <p className="eyebrow">Cadena de suministro</p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-tight">Proveedores</h1>
          <p className="text-[13px] text-[var(--color-ink-500)]">
            {proveedores.length} proveedores activos surten {products.length} SKUs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar proveedor…"
            className="h-9 w-[220px] rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 text-[12.5px] focus:border-[var(--color-focus)] focus:outline-none"
          />
          {showNewButton ? (
            <a
              href="/proveedores/nueva"
              className="btn-base h-9 bg-[var(--color-ocean)] px-3 text-[12.5px] font-medium text-white hover:bg-[var(--color-ocean-deep)]"
            >
              <Plus size={13} weight="bold" aria-hidden="true" />
              Nueva orden
            </a>
          ) : null}
        </div>
      </header>

      <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] bg-[var(--color-surface-muted)] text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-ink-500)]">
                <th className="px-3 py-2 font-medium">Proveedor</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">Contacto</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">Tel. / Email</th>
                <th className="px-3 py-2 text-right font-medium">SKUs</th>
                <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Valor stock</th>
                <th className="px-3 py-2 font-medium">Última orden</th>
                <th className="px-3 py-2 font-medium">Productos</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-sm text-[var(--color-ink-500)]">
                    Sin proveedores para mostrar.
                  </td>
                </tr>
              ) : (
                rows.map(({ proveedor: pr, productos: prods, valorTotal }) => (
                  <tr
                    key={pr.id}
                    id={pr.id}
                    className="dense-row border-b border-[var(--color-line)] align-top hover:bg-[var(--color-surface-muted)]"
                  >
                    <td className="px-3 py-3">
                      <a
                        href={`/proveedores#${pr.id}`}
                        className="flex items-center gap-2 text-[13px] font-medium hover:text-[var(--color-ocean)]"
                      >
                        <span
                          aria-hidden="true"
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[var(--color-ocean-soft)] text-[var(--color-ocean)]"
                        >
                          <Storefront size={13} weight="bold" />
                        </span>
                        <span className="truncate">{pr.nombre}</span>
                      </a>
                    </td>
                    <td className="hidden px-3 py-3 text-[12.5px] text-[var(--color-ink-700)] sm:table-cell">
                      {pr.contacto}
                    </td>
                    <td className="hidden px-3 py-3 text-[11.5px] text-[var(--color-ink-500)] md:table-cell">
                      <p className="inline-flex items-center gap-1.5">
                        <Phone size={11} weight="bold" aria-hidden="true" />
                        {pr.telefono}
                      </p>
                      <p className="inline-flex items-center gap-1.5">
                        <EnvelopeSimple size={11} weight="bold" aria-hidden="true" />
                        {pr.email}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="mono text-[13px] font-medium">
                        {formatNum(pr.skus.length)}
                      </span>
                    </td>
                    <td className="hidden px-3 py-3 text-right mono text-[12.5px] text-[var(--color-ink-700)] sm:table-cell">
                      {formatArs(valorTotal)}
                    </td>
                    <td className="px-3 py-3">
                      {pr.ultimaOrden ? (
                        <span className="mono text-[12px] text-[var(--color-ink-700)]">
                          {pr.ultimaOrden}
                        </span>
                      ) : (
                        <span className="mono text-[12px] text-[var(--color-ink-500)]">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <ul className="flex max-w-[260px] flex-wrap gap-1">
                        {prods.slice(0, 4).map((p) => (
                          <li
                            key={p.sku}
                            className="mono rounded-sm border border-[var(--color-line)] bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-[10.5px] text-[var(--color-ink-700)]"
                          >
                            <a href={`/producto/${encodeURIComponent(p.sku)}`} className="hover:text-[var(--color-ocean)]">
                              {p.sku}
                            </a>
                          </li>
                        ))}
                        {prods.length > 4 ? (
                          <li className="mono rounded-sm bg-[var(--color-ocean-soft)] px-1.5 py-0.5 text-[10.5px] text-[var(--color-ocean)]">
                            +{prods.length - 4}
                          </li>
                        ) : null}
                      </ul>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
