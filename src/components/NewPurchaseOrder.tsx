import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarBlank,
  CheckCircle,
  CircleNotch,
  Plus,
  Storefront,
  TrashSimple,
} from "@phosphor-icons/react";
import type { OrdenCompra, Product, Proveedor } from "../data/seed";
import { formatArs, formatNum, parseArsInput, parseStockInput } from "../lib/inventory";
import {
  appendAudit,
  appendOrden,
  loadInitial,
  loadProducts,
  loadProveedores,
  replaceAll,
} from "../lib/storage";
import { useOperario } from "./OperarioContext";

// ---------------------------------------------------------------------------
// NewPurchaseOrder — formulario de alta de orden de compra.
//
// Permite elegir proveedor, agregar líneas (sku + cantidad + precio) y
// guarda en el estado global (ordenes + audit).
// ---------------------------------------------------------------------------

interface LineaDraft {
  sku: string;
  cantidad: string;
  precio: string;
}

const EMPTY_LINE: LineaDraft = { sku: "", cantidad: "1", precio: "0" };

export default function NewPurchaseOrder() {
  const { active } = useOperario();
  const [products, setProducts] = useState<Product[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [proveedorId, setProveedorId] = useState<string>("");
  const [fechaEstimada, setFechaEstimada] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().slice(0, 10);
  });
  const [nota, setNota] = useState<string>("");
  const [lineas, setLineas] = useState<LineaDraft[]>([{ ...EMPTY_LINE }]);
  const [submitted, setSubmitted] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setProducts(loadProducts());
    setProveedores(loadProveedores());
    setHydrated(true);
  }, []);

  const proveedor = useMemo(
    () => proveedores.find((p) => p.id === proveedorId) ?? null,
    [proveedores, proveedorId],
  );

  const skusDelProveedor = useMemo(() => {
    if (!proveedor) return products;
    const set = new Set(proveedor.skus);
    return products.filter((p) => set.has(p.sku));
  }, [products, proveedor]);

  const total = useMemo(() => {
    return lineas.reduce((acc, l) => {
      const c = parseStockInput(l.cantidad) ?? 0;
      const p = parseArsInput(l.precio) ?? 0;
      return acc + c * p;
    }, 0);
  }, [lineas]);

  const lineErrors = useMemo(() => {
    return lineas.map((l) => {
      const errors: string[] = [];
      if (!l.sku) errors.push("Seleccioná un SKU.");
      const c = parseStockInput(l.cantidad);
      if (c === null || c <= 0) errors.push("Cantidad > 0.");
      const p = parseArsInput(l.precio);
      if (p === null || p < 0) errors.push("Precio inválido.");
      return errors;
    });
  }, [lineas]);

  const hasErrors =
    !proveedor ||
    lineas.length === 0 ||
    lineErrors.some((errs) => errs.length > 0);

  function addLine() {
    setLineas((l) => [...l, { ...EMPTY_LINE }]);
  }
  function removeLine(idx: number) {
    setLineas((l) => l.filter((_, i) => i !== idx));
  }
  function updateLine(idx: number, patch: Partial<LineaDraft>) {
    setLineas((l) => l.map((line, i) => (i === idx ? { ...line, ...patch } : line)));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (hasErrors || !proveedor || !active) return;
    const today = new Date().toISOString().slice(0, 10);
    const id = `OC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const orden: OrdenCompra = {
      id,
      proveedorId: proveedor.id,
      fecha: today,
      fechaEstimada,
      estado: "enviada",
      operario: active.nombre,
      nota: nota.trim() || undefined,
      lineas: lineas.map((l) => ({
        sku: l.sku,
        cantidad: parseStockInput(l.cantidad) ?? 0,
        precioUnitario: parseArsInput(l.precio) ?? 0,
      })),
    };
    const state = loadInitial();
    const updated = appendAudit(
      appendOrden(state, orden),
      {
        operario: active.nombre,
        accion: "orden_compra_creada",
        detalle: `Orden de compra ${id} a ${proveedor.nombre} (${orden.lineas.length} líneas, total ${formatArs(total)})`,
      },
    );
    replaceAll({
      ordenes: updated.ordenes,
      audit: updated.audit,
    });
    setSubmitted(true);
  }

  if (!hydrated) {
    return (
      <div className="grid place-items-center py-20 text-[var(--color-ink-500)]">
        <CircleNotch size={20} weight="bold" className="animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-md rounded-md border border-[var(--color-status-ok)]/30 bg-[color-mix(in_oklch,var(--color-status-ok)_8%,transparent)] p-6 text-center">
        <CheckCircle
          size={28}
          weight="bold"
          aria-hidden="true"
          className="mx-auto text-[var(--color-status-ok)]"
        />
        <h1 className="mt-2 text-[18px] font-semibold">Orden enviada</h1>
        <p className="mt-1 text-[13px] text-[var(--color-ink-700)]">
          Se registró la orden a {proveedor?.nombre}. Quedó en el log de auditoría.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <a
            href="/proveedores"
            className="btn-base h-9 border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-[12.5px] hover:bg-[var(--color-surface-muted)]"
          >
            <ArrowLeft size={12} weight="bold" aria-hidden="true" />
            Volver a proveedores
          </a>
          <a
            href="/auditoria"
            className="btn-base h-9 bg-[var(--color-ocean)] px-3 text-[12.5px] font-medium text-white hover:bg-[var(--color-ocean-deep)]"
          >
            Ver auditoría
          </a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <nav className="flex items-center gap-1 text-[12px] text-[var(--color-ink-500)]">
        <a href="/proveedores" className="hover:text-[var(--color-ocean)]">Proveedores</a>
        <span aria-hidden="true">/</span>
        <span className="text-[var(--color-ink-700)]">Nueva orden de compra</span>
      </nav>

      <header>
        <p className="eyebrow">Reposición</p>
        <h1 className="mt-1 text-[22px] font-semibold tracking-tight">Nueva orden de compra</h1>
        <p className="text-[13px] text-[var(--color-ink-500)]">
          Generá una orden a un proveedor con sus líneas y cantidades. Queda registrada en auditoría.
        </p>
      </header>

<section className="grid gap-4 sm:grid-cols-3">
        <Field label="Proveedor" required>
          <select
            value={proveedorId}
            onChange={(e) => setProveedorId(e.target.value)}
            className="h-10 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 text-[13px] focus:border-[var(--color-focus)] focus:outline-none"
            required
            aria-required="true"
            aria-invalid={!proveedorId || undefined}
            aria-describedby={!proveedorId ? "orden-errors" : undefined}
          >
            <option value="">Elegir proveedor…</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fecha estimada de entrega" required>
          <div className="relative">
            <CalendarBlank
              size={13}
              weight="bold"
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-500)]"
            />
            <input
              type="date"
              value={fechaEstimada}
              onChange={(e) => setFechaEstimada(e.target.value)}
              className="h-10 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] pl-8 pr-2.5 text-[13px] focus:border-[var(--color-focus)] focus:outline-none"
              aria-required="true"
            />
          </div>
        </Field>
        <Field label="Operario">
          <div className="flex h-10 items-center gap-2 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-muted)] px-2.5 text-[12.5px] text-[var(--color-ink-700)]">
            <span className="grid h-5 w-5 place-items-center rounded-[3px] bg-[var(--color-ocean)] font-mono text-[9px] font-semibold uppercase text-white">
              {active?.nombre.split(/\s+/).slice(0, 2).map((w) => w[0]).join("") ?? "?"}
            </span>
            <span>{active?.nombre ?? "—"}</span>
          </div>
        </Field>
      </section>

      {proveedor ? (
        <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-muted)] px-3 py-2 text-[12px] text-[var(--color-ink-700)]">
          <span className="mono inline-flex items-center gap-1.5 rounded-sm bg-[var(--color-ocean-soft)] px-1.5 py-0.5 text-[var(--color-ocean)]">
            <Storefront size={11} weight="bold" aria-hidden="true" />
            {proveedor.nombre}
          </span>
          <span className="ml-2">{proveedor.contacto} · {proveedor.telefono}</span>
          <span className="ml-2 text-[var(--color-ink-500)]">
            Surte {proveedor.skus.length} SKUs
          </span>
        </section>
      ) : null}

      <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)]">
        <header className="flex items-center justify-between gap-2 border-b border-[var(--color-line)] px-4 py-2.5">
          <h2 className="text-[13px] font-semibold">Líneas de la orden</h2>
          <button
            type="button"
            onClick={addLine}
            className="btn-base h-8 border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 text-[12px] hover:bg-[var(--color-surface-muted)]"
          >
            <Plus size={12} weight="bold" aria-hidden="true" />
            Agregar línea
          </button>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] bg-[var(--color-surface-muted)] text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-ink-500)]">
                <th className="px-3 py-2 font-medium">SKU / Producto</th>
                <th className="px-3 py-2 text-right font-medium">Cantidad</th>
                <th className="px-3 py-2 text-right font-medium">Precio unit.</th>
                <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                <th className="px-3 py-2" aria-label="Quitar" />
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, idx) => {
                const c = parseStockInput(l.cantidad) ?? 0;
                const p = parseArsInput(l.precio) ?? 0;
                const errs = lineErrors[idx];
                return (
                  <tr key={idx} className="dense-row border-b border-[var(--color-line)]">
<td className="px-3 py-2">
                      <select
                        value={l.sku}
                        onChange={(e) => updateLine(idx, { sku: e.target.value })}
                        className="h-9 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 text-[12.5px] focus:border-[var(--color-focus)] focus:outline-none"
                        aria-label={`SKU línea ${idx + 1}`}
                        aria-invalid={!l.sku || undefined}
                        aria-describedby={errs.length > 0 ? `line-${idx}-errors` : undefined}
                      >
                        <option value="">Elegir SKU…</option>
                        {skusDelProveedor.map((prod) => (
                          <option key={prod.sku} value={prod.sku}>
                            {prod.sku} — {prod.nombre}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        value={l.cantidad}
                        onChange={(e) => updateLine(idx, { cantidad: e.target.value })}
                        className="mono h-9 w-20 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 text-right text-[12.5px] focus:border-[var(--color-focus)] focus:outline-none"
                        aria-label={`Cantidad línea ${idx + 1}`}
                        aria-invalid={errs.length > 0 || undefined}
                        aria-describedby={errs.length > 0 ? `line-${idx}-errors` : undefined}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={l.precio}
                        onChange={(e) => updateLine(idx, { precio: e.target.value })}
                        className="mono h-9 w-28 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 text-right text-[12.5px] focus:border-[var(--color-focus)] focus:outline-none"
                        aria-label={`Precio unitario línea ${idx + 1}`}
                        aria-invalid={errs.length > 0 || undefined}
                        aria-describedby={errs.length > 0 ? `line-${idx}-errors` : undefined}
                      />
                    </td>
                    <td className="px-3 py-2 text-right mono text-[13px] font-medium">
                      {formatArs(c * p)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        disabled={lineas.length === 1}
                        aria-label="Quitar línea"
                        className="btn-base grid h-8 w-8 place-items-center border border-[var(--color-line)] text-[var(--color-ink-500)] hover:border-[var(--color-status-bad)] hover:text-[var(--color-status-bad)] disabled:opacity-40"
                      >
                        <TrashSimple size={12} weight="bold" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[var(--color-surface-muted)]">
                <td className="px-3 py-2.5 text-[12.5px] font-medium" colSpan={3}>
                  Total ({formatNum(lineas.length)} líneas)
                </td>
                <td className="px-3 py-2.5 text-right mono text-[14px] font-semibold">
                  {formatArs(total)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
{lineErrors.flat().length > 0 ? (
          <ul
            id="orden-errors"
            className="border-t border-[var(--color-line)] px-4 py-2 text-[12px] text-[var(--color-status-bad)]"
          >
            {lineErrors.flatMap((errs, i) =>
              errs.length === 0
                ? []
                : [
                    <li
                      key={i}
                      id={`line-${i}-errors`}
                      role="alert"
                      className="block"
                    >
                      Línea {i + 1}: {errs.join(" · ")}
                    </li>,
                  ],
            )}
          </ul>
        ) : null}
      </section>

      <Field label="Nota (opcional)">
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 py-2 text-[13px] focus:border-[var(--color-focus)] focus:outline-none"
        />
      </Field>

      <div className="flex flex-col-reverse gap-2 border-t border-[var(--color-line)] pt-4 sm:flex-row sm:justify-end">
        <a
          href="/proveedores"
          className="btn-base h-10 border border-[var(--color-line)] bg-[var(--color-surface)] px-4 text-sm hover:bg-[var(--color-surface-muted)]"
        >
          Cancelar
        </a>
        <button
          type="submit"
          disabled={hasErrors || !active}
          className="btn-base h-10 bg-[var(--color-ocean)] px-4 text-sm font-medium text-white hover:bg-[var(--color-ocean-deep)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={14} weight="bold" aria-hidden="true" />
          Crear orden
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-ink-500)]">
        {label}
        {required ? <span className="ml-0.5 text-[var(--color-status-bad)]">*</span> : null}
      </span>
      {children}
    </label>
  );
}
