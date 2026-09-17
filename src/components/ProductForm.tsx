import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle, FloppyDisk, Tag, X } from "@phosphor-icons/react";
import {
  type Category,
  type Product,
  SEED_PRODUCTS,
} from "../data/seed";
import {
  formatArs,
  parseArsInput,
  parseStockInput,
  suggestSku,
} from "../lib/inventory";
import { loadProducts, upsertProduct, writeState } from "../lib/storage";

// ---------------------------------------------------------------------------
// ProductForm island
//
// Used in two modes:
//   * "create" — `/producto/nuevo`
//   * "edit"   — `/producto/editar?sku=XXX`
// Persists directly to localStorage and redirects to `/`.
// ---------------------------------------------------------------------------

type Mode = "create" | "edit";

const CATEGORY_OPTIONS: Category[] = [
  "Arroz",
  "Fideos",
  "Aceite",
  "Legumbres",
  "Conservas",
  "Condimentos",
];

const UNIDAD_OPTIONS = ["kg", "l", "un"] as const;

interface Props {
  mode: Mode;
  /**
   * Optional pre-resolved SKU (e.g. passed by Astro). When undefined we
   * read it from `?sku=` on the client; this lets the page be statically
   * generated regardless of which SKUs exist in localStorage.
   */
  sku?: string;
}

interface FormState {
  nombre: string;
  sku: string;
  categoria: Category;
  stockActual: string;
  stockMinimo: string;
  unidad: (typeof UNIDAD_OPTIONS)[number];
  precioUnitario: string;
}

const EMPTY_FORM: FormState = {
  nombre: "",
  sku: "",
  categoria: "Arroz",
  stockActual: "0",
  stockMinimo: "0",
  unidad: "un",
  precioUnitario: "0",
};

function productToForm(p: Product): FormState {
  return {
    nombre: p.nombre,
    sku: p.sku,
    categoria: p.categoria,
    stockActual: String(p.stockActual),
    stockMinimo: String(p.stockMinimo),
    unidad: (UNIDAD_OPTIONS as readonly string[]).includes(p.unidad)
      ? (p.unidad as FormState["unidad"])
      : "un",
    precioUnitario: String(p.precioUnitario),
  };
}

export default function ProductForm({ mode, sku: skuProp }: Props) {
  const [hydrated, setHydrated] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [originalSku, setOriginalSku] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [savedOk, setSavedOk] = useState<null | "ok" | "error">(null);

  useEffect(() => {
    const list = loadProducts();
    setProducts(list);
    let resolved = skuProp ?? "";
    if (mode === "edit" && !resolved && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      resolved = params.get("sku") ?? "";
    }
    setHydrated(true);
    if (mode === "edit" && resolved) {
      const target = list.find((p) => p.sku === resolved);
      if (target) {
        setForm(productToForm(target));
        setOriginalSku(target.sku);
      }
    }
  }, [mode, skuProp]);

  // ---- Live SKU suggestion in create mode --------------------------------
  const suggestedSku = useMemo(() => {
    if (mode !== "create") return "";
    if (!form.nombre.trim()) return suggestSku("placeholder", form.categoria, products);
    return suggestSku(form.nombre, form.categoria, products);
  }, [form.nombre, form.categoria, products, mode]);

  useEffect(() => {
    if (mode === "create" && !form.sku) setForm((f) => ({ ...f, sku: suggestedSku }));
  }, [suggestedSku, mode, form.sku]);

  // ---- Validation --------------------------------------------------------
  const errors = useMemo(() => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.nombre.trim()) e.nombre = "Ingresá un nombre.";
    else if (form.nombre.trim().length < 3)
      e.nombre = "Mínimo 3 caracteres.";
    if (!form.sku.trim()) e.sku = "El SKU es obligatorio.";
    else if (!/^[A-Z0-9-]{3,20}$/.test(form.sku.toUpperCase()))
      e.sku = "Solo letras, números y guion. 3-20 caracteres.";
    else if (
      mode === "create" &&
      products.some((p) => p.sku === form.sku.toUpperCase())
    )
      e.sku = "Ya existe un producto con este SKU.";
    else if (
      mode === "edit" &&
      form.sku.toUpperCase() !== originalSku &&
      products.some((p) => p.sku === form.sku.toUpperCase())
    )
      e.sku = "Ya existe otro producto con este SKU.";

    const stockActual = parseStockInput(form.stockActual);
    if (stockActual === null) e.stockActual = "Número entero ≥ 0.";
    const stockMinimo = parseStockInput(form.stockMinimo);
    if (stockMinimo === null) e.stockMinimo = "Número entero ≥ 0.";

    const precio = parseArsInput(form.precioUnitario);
    if (precio === null) e.precioUnitario = "Precio inválido.";
    return e;
  }, [form, products, mode, originalSku]);

  const hasErrors = Object.keys(errors).length > 0;

  // ---- Submit ------------------------------------------------------------
  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (hasErrors) {
      setSavedOk("error");
      return;
    }
    const stockActual = parseStockInput(form.stockActual) ?? 0;
    const stockMinimo = parseStockInput(form.stockMinimo) ?? 0;
    const precio = parseArsInput(form.precioUnitario) ?? 0;
    const next: Product = {
      sku: form.sku.toUpperCase(),
      nombre: form.nombre.trim(),
      categoria: form.categoria,
      stockActual,
      stockMinimo,
      unidad: form.unidad,
      precioUnitario: precio,
      actualizadoEn: new Date().toISOString().slice(0, 10),
    };
    const merged = upsertProduct(products, next);
    writeState(merged);
    setSavedOk("ok");
    // Slight pause so the user sees the confirmation, then navigate.
    window.setTimeout(() => {
      window.location.href = `/?q=${encodeURIComponent(next.sku)}`;
    }, 600);
  }

  const showError = (key: keyof FormState) =>
    submitted && errors[key] ? errors[key] : null;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <a
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-700)] hover:text-[var(--color-ocean)]"
      >
        <ArrowLeft size={14} weight="bold" aria-hidden="true" />
        Volver al inventario
      </a>

      <div className="mt-4">
        <p className="eyebrow">
          {mode === "create" ? "Alta de producto" : "Edición de producto"}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--color-ink-900)] sm:text-[28px]">
          {mode === "create" ? "Nuevo producto" : form.nombre || "Editar producto"}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-ink-700)]">
          {mode === "create"
            ? "Sumá un SKU al catálogo. El umbral mínimo define cuándo se dispara la alerta de bajo stock."
            : "Modificá los datos del producto. El umbral mínimo define cuándo se dispara la alerta de bajo stock."}
        </p>
      </div>

      {savedOk === "error" ? (
        <div
          role="alert"
          className="mt-6 flex items-start gap-2 rounded-md border border-[var(--color-status-bad)]/40 bg-[color-mix(in_oklch,var(--color-status-bad)_10%,transparent)] p-3 text-sm text-[var(--color-status-bad)]"
        >
          <X size={16} weight="bold" aria-hidden="true" />
          Revisá los campos marcados antes de guardar.
        </div>
      ) : null}
      {savedOk === "ok" ? (
        <div
          role="status"
          className="mt-6 flex items-start gap-2 rounded-md border border-[var(--color-status-ok)]/40 bg-[color-mix(in_oklch,var(--color-status-ok)_10%,transparent)] p-3 text-sm text-[var(--color-status-ok)]"
        >
          <CheckCircle size={16} weight="bold" aria-hidden="true" />
          Producto guardado. Redirigiendo al inventario…
        </div>
      ) : null}

      <form
        onSubmit={onSubmit}
        noValidate
        className="mt-6 space-y-5 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:p-6"
      >
        {/* Nombre */}
        <Field
          id="f-nombre"
          label="Nombre del producto"
          required
          error={showError("nombre")}
        >
          <input
            id="f-nombre"
            type="text"
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            autoComplete="off"
            placeholder="Ej.: Arroz largo fino 1 kg"
            aria-invalid={Boolean(showError("nombre"))}
            className="h-10 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-500)] focus:border-[var(--color-focus)] focus:outline-none"
          />
        </Field>

        {/* SKU + Categoría */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="f-sku"
            label="SKU"
            hint={
              mode === "create" && !form.sku
                ? "Sugerencia generada automáticamente."
                : "Solo letras, números y guion."
            }
            required
            error={showError("sku")}
          >
            <div className="relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-500)]"
              >
                <Tag size={14} weight="regular" />
              </span>
              <input
                id="f-sku"
                type="text"
                value={form.sku}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    sku: e.target.value.toUpperCase().replace(/\s/g, ""),
                  }))
                }
                placeholder="ARR-LAR-001"
                spellCheck={false}
                aria-invalid={Boolean(showError("sku"))}
                className="h-10 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] pl-9 pr-3 font-mono text-sm uppercase tracking-wide text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-500)] focus:border-[var(--color-focus)] focus:outline-none"
              />
            </div>
          </Field>
          <Field id="f-cat" label="Categoría" required>
            <select
              id="f-cat"
              value={form.categoria}
              onChange={(e) =>
                setForm((f) => ({ ...f, categoria: e.target.value as Category }))
              }
              className="h-10 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-ink-900)] focus:border-[var(--color-focus)] focus:outline-none"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Stock + mínimo + unidad */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            id="f-stock"
            label="Stock actual"
            required
            error={showError("stockActual")}
          >
            <input
              id="f-stock"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={form.stockActual}
              onChange={(e) => setForm((f) => ({ ...f, stockActual: e.target.value }))}
              aria-invalid={Boolean(showError("stockActual"))}
              className="mono h-10 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-right text-sm text-[var(--color-ink-900)] focus:border-[var(--color-focus)] focus:outline-none"
            />
          </Field>
          <Field
            id="f-min"
            label="Stock mínimo (umbral)"
            required
            hint="Alerta cuando stock actual ≤ mínimo."
            error={showError("stockMinimo")}
          >
            <input
              id="f-min"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={form.stockMinimo}
              onChange={(e) => setForm((f) => ({ ...f, stockMinimo: e.target.value }))}
              aria-invalid={Boolean(showError("stockMinimo"))}
              className="mono h-10 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-right text-sm text-[var(--color-ink-900)] focus:border-[var(--color-focus)] focus:outline-none"
            />
          </Field>
          <Field id="f-unidad" label="Unidad" required>
            <select
              id="f-unidad"
              value={form.unidad}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  unidad: e.target.value as FormState["unidad"],
                }))
              }
              className="h-10 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-ink-900)] focus:border-[var(--color-focus)] focus:outline-none"
            >
              {UNIDAD_OPTIONS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Precio */}
        <Field
          id="f-precio"
          label="Precio unitario (ARS)"
          required
          hint="Usado para el valor estimado del inventario."
          error={showError("precioUnitario")}
        >
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-[var(--color-ink-500)]"
            >
              $
            </span>
            <input
              id="f-precio"
              type="text"
              inputMode="decimal"
              value={form.precioUnitario}
              onChange={(e) => setForm((f) => ({ ...f, precioUnitario: e.target.value }))}
              placeholder="0"
              aria-invalid={Boolean(showError("precioUnitario"))}
              className="mono h-10 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] pl-7 pr-3 text-right text-sm text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-500)] focus:border-[var(--color-focus)] focus:outline-none"
            />
          </div>
          {form.precioUnitario && parseArsInput(form.precioUnitario) !== null ? (
            <p className="mt-1.5 text-xs text-[var(--color-ink-500)]">
              Se mostrará como{" "}
              <span className="font-mono text-[var(--color-ink-700)]">
                {formatArs(parseArsInput(form.precioUnitario) ?? 0)}
              </span>
            </p>
          ) : null}
        </Field>

        <div className="flex flex-col-reverse gap-2 border-t border-[var(--color-line)] pt-4 sm:flex-row sm:justify-end">
          <a
            href="/"
            className="btn-base h-10 border border-[var(--color-line)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)]"
          >
            Cancelar
          </a>
          <button
            type="submit"
            className="btn-base h-10 bg-[var(--color-ocean)] px-4 text-sm font-medium text-white hover:bg-[var(--color-ocean-deep)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!hydrated || savedOk === "ok"}
          >
            <FloppyDisk size={14} weight="bold" aria-hidden="true" />
            {mode === "create" ? "Crear producto" : "Guardar cambios"}
          </button>
        </div>
      </form>

      {mode === "edit" && hydrated && !originalSku ? (
        <div
          role="alert"
          className="mt-6 rounded-md border border-[var(--color-status-bad)]/40 bg-[color-mix(in_oklch,var(--color-status-bad)_10%,transparent)] p-3 text-sm text-[var(--color-status-bad)]"
        >
          No se encontró el producto con SKU{" "}
          <code className="font-mono">{skuProp ?? ""}</code>. Volvé al inventario
          para elegir otro.
        </div>
      ) : null}

      {mode === "create" ? (
        <p className="mt-4 text-xs text-[var(--color-ink-500)]">
          Catálogo inicial con {SEED_PRODUCTS.length} productos demo. Si querés
          volver al estado de fábrica, usá "Restablecer" en el panel principal.
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field — label + control + helper/error. Standardised so contrast, spacing
// and font sizes stay consistent across the form.
// ---------------------------------------------------------------------------

function Field({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 flex items-center justify-between text-xs font-medium text-[var(--color-ink-700)]"
      >
        <span>
          {label}
          {required ? (
            <span aria-hidden="true" className="ml-0.5 text-[var(--color-status-bad)]">
              *
            </span>
          ) : null}
        </span>
        {hint && !error ? (
          <span className="text-[11px] font-normal text-[var(--color-ink-500)]">
            {hint}
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1.5 text-xs text-[var(--color-status-bad)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
