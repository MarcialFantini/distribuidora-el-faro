import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowsDownUp,
  CaretDown,
  CaretLeft,
  CaretRight,
} from "@phosphor-icons/react";

// ---------------------------------------------------------------------------
// DataTable — tabla genérica con sort + paginación client-side.
//
// Uso:
//   <DataTable<Row>
//     columns={[
//       { key: "sku", header: "SKU", render: r => r.sku, sortBy: r => r.sku, width: "12%" }
//     ]}
//     rows={rows}
//     pageSize={20}
//     initialSort={{ key: "sku", dir: "asc" }}
//   />
//
// Si el filtro cambia desde afuera, el componente resetea a página 1.
// ---------------------------------------------------------------------------

export interface Column<T> {
  /** Identificador estable para sortBy. */
  key: string;
  header: ReactNode;
  render: (row: T, idx: number) => ReactNode;
  /** Función opcional para sort. Si se omite, sortBy = row[key]. */
  sortBy?: (row: T) => string | number;
  /** Ancho opcional del th. */
  width?: string;
  /** Alineación (default "left"). */
  align?: "left" | "right" | "center";
  /** Clases extra para celda td. */
  cellClassName?: string;
  /** Si false, oculta en mobile. */
  showOnMobile?: boolean;
}

interface SortState {
  key: string;
  dir: "asc" | "desc";
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  pageSize?: number;
  initialSort?: SortState;
  /** ID estable para key en Astro hydration. */
  tableId?: string;
  /** Cuando cambia, vuelve a página 1. Útil si hay filtros externos. */
  resetKey?: string;
  /** Etiqueta del footer "Total: X filas". */
  totalLabel?: string;
  /** Empty state. */
  emptyMessage?: ReactNode;
}

export default function DataTable<T>({
  columns,
  rows,
  pageSize = 20,
  initialSort,
  tableId = "dt",
  resetKey,
  totalLabel = "filas",
  emptyMessage = "Sin resultados.",
}: Props<T>) {
  const [sort, setSort] = useState<SortState | null>(initialSort ?? null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [resetKey]);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const getter = col.sortBy ?? ((r: T) => (r as Record<string, unknown>)[sort.key] as string | number);
    const copy = rows.slice();
    copy.sort((a, b) => {
      const va = getter(a);
      const vb = getter(b);
      if (typeof va === "number" && typeof vb === "number") {
        return sort.dir === "asc" ? va - vb : vb - va;
      }
      const sa = String(va ?? "");
      const sb = String(vb ?? "");
      return sort.dir === "asc"
        ? sa.localeCompare(sb, "es")
        : sb.localeCompare(sa, "es");
    });
    return copy;
  }, [rows, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize);

  function toggleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  return (
    <div className="flex flex-col">
      <div className="-mx-px overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] bg-[var(--color-surface-muted)]">
              {columns.map((c) => {
                const isSorted = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    style={{ width: c.width }}
                    className={[
                      "px-3 py-2 text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--color-ink-500)]",
                      c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                      c.showOnMobile === false ? "hidden sm:table-cell" : "",
                      c.sortBy || sort?.key === c.key || (columns.find((x) => x.key === c.key)?.sortBy) ? "cursor-pointer select-none" : "",
                    ].join(" ")}
                    onClick={() => {
                      if (c.sortBy || true) toggleSort(c.key);
                    }}
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.header}
                      {isSorted ? (
                        <span className="text-[var(--color-ocean)]">
                          <CaretDown
                            size={10}
                            weight="bold"
                            aria-hidden="true"
                            style={{
                              transform: sort?.dir === "asc" ? "rotate(180deg)" : "none",
                              transition: "transform 120ms",
                            }}
                          />
                        </span>
                      ) : c.sortBy ? (
                        <ArrowsDownUp
                          size={10}
                          aria-hidden="true"
                          className="text-[var(--color-ink-300)]"
                        />
                      ) : null}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody id={tableId}>
            {pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-10 text-center text-sm text-[var(--color-ink-500)]"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageRows.map((row, idx) => (
                <tr
                  key={idx}
                  className="dense-row border-b border-[var(--color-line)] transition-colors hover:bg-[var(--color-surface-muted)]"
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={[
                        "px-3 py-2 align-middle",
                        c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                        c.showOnMobile === false ? "hidden sm:table-cell" : "",
                        c.cellClassName ?? "",
                      ].join(" ")}
                    >
                      {c.render(row, safePage * pageSize + idx)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 || sorted.length > 0 ? (
        <div className="mt-3 flex flex-col items-start justify-between gap-2 border-t border-[var(--color-line)] pt-3 text-[12px] text-[var(--color-ink-500)] sm:flex-row sm:items-center">
          <span>
            <span className="mono font-medium text-[var(--color-ink-700)]">
              {sorted.length.toLocaleString("es-AR")}
            </span>{" "}
            {totalLabel}
            {pageCount > 1 ? (
              <>
                {" · pág "}
                <span className="mono">{safePage + 1}</span>
                <span className="text-[var(--color-ink-300)]">/</span>
                <span className="mono">{pageCount}</span>
              </>
            ) : null}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              aria-label="Página anterior"
              className="btn-base grid h-7 w-7 place-items-center border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CaretLeft size={12} weight="bold" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
              aria-label="Página siguiente"
              className="btn-base grid h-7 w-7 place-items-center border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CaretRight size={12} weight="bold" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
