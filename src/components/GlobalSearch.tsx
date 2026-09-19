import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Cube,
  Package,
  Storefront,
  Tag,
  X,
} from "@phosphor-icons/react";
import {
  loadProducts,
  loadProveedores,
} from "../lib/storage";
import type { Product, Proveedor } from "../data/seed";

// ---------------------------------------------------------------------------
// GlobalSearch — paleta Cmd+K que busca productos / categorías / proveedores.
// Atajo Cmd+K (Mac) o Ctrl+K (Win/Linux).
// Cada resultado es un enlace: productos → /producto/[sku]; categorías y
// proveedores → anclas a secciones internas.
// ---------------------------------------------------------------------------

type ResultKind = "producto" | "categoria" | "proveedor";

interface ResultItem {
  kind: ResultKind;
  title: string;
  subtitle?: string;
  href: string;
}

function buildResults(
  products: Product[],
  proveedores: Proveedor[],
  q: string,
): ResultItem[] {
  const trimmed = q.trim().toLowerCase();
  if (trimmed.length === 0) return [];
  const matches: ResultItem[] = [];

  for (const p of products) {
    const haystack = `${p.sku} ${p.nombre} ${p.categoria}`.toLowerCase();
    if (haystack.includes(trimmed)) {
      matches.push({
        kind: "producto",
        title: p.nombre,
        subtitle: p.sku,
        href: `/producto/${encodeURIComponent(p.sku)}`,
      });
    }
  }

const cats = new Set<string>();
  for (const p of products) {
    if (p.categoria.toLowerCase().includes(trimmed)) cats.add(p.categoria);
  }
  for (const c of cats) {
    matches.push({
      kind: "categoria",
      title: c,
      subtitle: "Categoría",
      href: `/categorias#${encodeURIComponent(c.toLowerCase())}`,
    });
  }

  for (const pr of proveedores) {
    const haystack = `${pr.nombre} ${pr.contacto}`.toLowerCase();
    if (haystack.includes(trimmed)) {
      matches.push({
        kind: "proveedor",
        title: pr.nombre,
        subtitle: `Surte ${pr.skus.length} SKU`,
        href: `/proveedores#${encodeURIComponent(pr.id)}`,
      });
    }
  }

  return matches.slice(0, 12);
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProducts(loadProducts());
    setProveedores(loadProveedores());
  }, [open]);

  // Atajo Cmd/Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      // Espera al render
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(
    () => buildResults(products, proveedores, query),
    [products, proveedores, query],
  );

  useEffect(() => {
    if (activeIdx >= results.length) setActiveIdx(0);
  }, [results, activeIdx]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && results[activeIdx]) {
      e.preventDefault();
      window.location.href = results[activeIdx].href;
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir búsqueda global"
        className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-[12.5px] text-[var(--color-ink-500)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink-700)]"
      >
        <svg
          xmlns="http://www.w3.org/w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span className="hidden md:inline">Buscar productos, categorías, proveedores…</span>
        <span className="md:hidden">Buscar</span>
        <kbd
          aria-hidden="true"
          className="mono hidden rounded border border-[var(--color-line)] bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-[10px] text-[var(--color-ink-500)] md:inline-block"
        >
          ⌘K
        </kbd>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Búsqueda global"
          className="fixed inset-0 z-50 flex items-start justify-center bg-[oklch(0_0_0_/_0.55)] px-4 pt-[12vh] backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-xl overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] shadow-2xl">
            <div className="flex items-center gap-2 border-b border-[var(--color-line)] px-3 py-2">
              <svg
                xmlns="http://www.w3.org/w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="text-[var(--color-ink-500)]"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Buscar productos, categorías o proveedores…"
                className="h-9 w-full bg-transparent text-sm text-[var(--color-ink-900)] outline-none placeholder:text-[var(--color-ink-500)]"
                autoComplete="off"
                aria-controls="global-search-results"
                aria-activedescendant={
                  results[activeIdx]
                    ? `gsr-${results[activeIdx].kind}-${results[activeIdx].href}`
                    : undefined
                }
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar búsqueda"
                className="grid h-7 w-7 place-items-center rounded-md border border-[var(--color-line)] text-[var(--color-ink-500)] hover:bg-[var(--color-surface-muted)]"
              >
                <X size={12} weight="bold" aria-hidden="true" />
              </button>
            </div>
            <ul
              id="global-search-results"
              role="listbox"
              className="max-h-80 overflow-auto py-1"
            >
              {results.length === 0 ? (
                <li className="px-3 py-6 text-center text-[13px] text-[var(--color-ink-500)]">
                  {query.trim().length === 0
                    ? "Empezá a tipear para buscar."
                    : "Sin resultados."}
                </li>
              ) : (
                results.map((r, i) => (
                  <li key={r.href} role="option" aria-selected={i === activeIdx}>
                    <a
                      id={`gsr-${r.kind}-${r.href}`}
                      href={r.href}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={`flex items-center gap-3 px-3 py-2 text-sm ${
                        i === activeIdx
                          ? "bg-[var(--color-ocean-soft)] text-[var(--color-ink-900)]"
                          : "text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)]"
                      }`}
                    >
                      <KindIcon kind={r.kind} />
                      <span className="flex-1 truncate">
                        <span className="font-medium">{r.title}</span>
                        {r.subtitle ? (
                          <span className="ml-2 mono text-[11px] text-[var(--color-ink-500)]">
                            {r.subtitle}
                          </span>
                        ) : null}
                      </span>
                      <ArrowRight
                        size={12}
                        weight="bold"
                        aria-hidden="true"
                        className="text-[var(--color-ink-500)]"
                      />
                    </a>
                  </li>
                ))
              )}
            </ul>
            <footer className="flex items-center justify-between border-t border-[var(--color-line)] bg-[var(--color-surface-muted)] px-3 py-1.5 text-[11px] text-[var(--color-ink-500)]">
              <span>
                <kbd className="mono rounded border border-[var(--color-line)] bg-[var(--color-surface)] px-1">↑↓</kbd>{" "}
                navegar{" "}
                <kbd className="mono rounded border border-[var(--color-line)] bg-[var(--color-surface)] px-1">↵</kbd>{" "}
                abrir{" "}
                <kbd className="mono rounded border border-[var(--color-line)] bg-[var(--color-surface)] px-1">esc</kbd>{" "}
                cerrar
              </span>
              <span className="mono uppercase tracking-[0.08em]">
                Distribuidora El Faro · ⌘K
              </span>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}

function KindIcon({ kind }: { kind: ResultKind }) {
  if (kind === "producto")
    return (
      <Package
        size={14}
        weight="bold"
        aria-hidden="true"
        className="text-[var(--color-ocean)]"
      />
    );
  if (kind === "categoria")
    return (
      <Tag
        size={14}
        weight="bold"
        aria-hidden="true"
        className="text-[var(--color-status-ok)]"
      />
    );
  return (
    <Storefront
      size={14}
      weight="bold"
      aria-hidden="true"
      className="text-[var(--color-alert)]"
    />
  );
}

// Re-export para que la paleta esté disponible en otros lados.
export { Cube };
