import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle, FloppyDisk } from "@phosphor-icons/react";
import {
  type Product,
  SEED_PRODUCTS,
} from "../data/seed";
import {
  parseArsInput,
  parseStockInput,
  suggestSku,
} from "../lib/inventory";
import { deriveCategories } from "../lib/categories";
import {
  appendAudit,
  loadInitial,
  loadProducts,
  replaceAll,
  upsertProduct,
} from "../lib/storage";
import { useOperario } from "./OperarioContext";

// ProductForm island — alta y edición con auditoría.

type Mode = "create" | "edit";

const UNIDAD_OPTIONS = ["kg", "l", "un"] as const;

interface Props {
  mode: Mode;
  sku?: string;
}

interface FormState {
  nombre: string;
  sku: string;
  categoria: string;
  stockActual: string;
  stockMinimo: string;
  unidad: (typeof UNIDAD_OPTIONS)[number];
  precioUnitario: string;
  notas: string;
  imagenUrl: string;
}

const EMPTY_FORM: FormState = {
  nombre: "",
  sku: "",
  categoria: "Arroz",
  stockActual: "0",
  stockMinimo: "0",
  unidad: "un",
  precioUnitario: "0",
  notas: "",
  imagenUrl: "",
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
    notas: p.notas ?? "",
    imagenUrl: p.imagenUrl ?? "",
  };
}

const LIMITS = {
  nombre: { max: 80 },
  sku: { max: 20 },
  categoria: { max: 30 },
  notas: { max: 500 },
  imagenUrl: { max: 500 },
} as const;

function isValidUrl(raw: string): boolean {
  if (!raw) return true; // vacío es válido
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function ProductForm({ mode, sku: skuProp }: Props) {
  const { active } = useOperario();
  const [hydrated, setHydrated] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [originalSku, setOriginalSku] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

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

  // Categorías que se ofrecen en el selector: derivamos dinámicamente de los
  // productos existentes más las del seed.
  const categoryOptions = useMemo(() => deriveCategories(products), [products]);

  const suggestedSku = useMemo(() => {
    if (mode !== "create") return "";
    if (!form.nombre.trim()) return suggestSku("placeholder", form.categoria, products);
    return suggestSku(form.nombre, form.categoria, products);
  }, [form.nombre, form.categoria, products, mode]);

  useEffect(() => {
    if (mode === "create" && !form.sku) setForm((f) => ({ ...f, sku: suggestedSku }));
  }, [suggestedSku, mode, form.sku]);

  const errors = useMemo(() => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.nombre.trim()) e.nombre = "Ingresá un nombre.";
    else if (form.nombre.trim().length < 3) e.nombre = "Mínimo 3 caracteres.";
    else if (form.nombre.length > LIMITS.nombre.max) e.nombre = `Máximo ${LIMITS.nombre.max} caracteres.`;
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
    if (!form.categoria.trim()) e.categoria = "Elegí o creá una categoría.";
    else if (form.categoria.length > LIMITS.categoria.max)
      e.categoria = `Máximo ${LIMITS.categoria.max} caracteres.`;
    if (form.notas.length > LIMITS.notas.max)
      e.notas = `Máximo ${LIMITS.notas.max} caracteres.`;
    if (!isValidUrl(form.imagenUrl))
      e.imagenUrl = "URL inválida (http o https).";
    return e;
  }, [form, products, mode, originalSku]);

  // Errores "filtrados" — solo los mostramos como rojos después del primer
  // toque del campo, o siempre si el usuario ya intentó enviar.
  const showError = (key: keyof FormState) =>
    Boolean(errors[key]) && (touched[key] || submitted);

  const hasErrors = Object.keys(errors).length > 0;

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setTouched((t) => ({ ...t, [key]: true }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (hasErrors) {
      // Marca todos los campos como tocados para mostrar todos los errores.
      setTouched({
        nombre: true,
        sku: true,
        categoria: true,
        stockActual: true,
        stockMinimo: true,
        unidad: true,
        precioUnitario: true,
        notas: true,
        imagenUrl: true,
      });
      return;
    }
    const sku = form.sku.trim().toUpperCase();
    const stockActual = parseStockInput(form.stockActual) ?? 0;
    const stockMinimo = parseStockInput(form.stockMinimo) ?? 0;
    const precio = parseArsInput(form.precioUnitario) ?? 0;
    const operario = active?.nombre ?? "Operario";
    const next: Product = {
      sku,
      nombre: form.nombre.trim(),
      categoria: form.categoria.trim(),
      stockActual,
      stockMinimo,
      unidad: form.unidad,
      precioUnitario: precio,
      actualizadoEn: new Date().toISOString().slice(0, 10),
      notas: form.notas.trim() || undefined,
      imagenUrl: form.imagenUrl.trim() || undefined,
    };
    const merged = upsertProduct(products, next);
    const cur = loadInitial();
    const accion =
      mode === "create" ? "alta_producto" : "edicion_producto";
    const detalle =
      mode === "create"
        ? `Creó producto ${next.nombre} (${next.sku})`
        : `Editó ${next.nombre} (${next.sku})`;
    const updated = appendAudit({ ...cur, products: merged }, {
      operario,
      accion,
      detalle,
      sku,
    });
    replaceAll({ products: updated.products, audit: updated.audit });
    setProducts(updated.products);
    setSubmitted(true);
    setTimeout(() => { window.location.href = "/"; }, 700);
  }

  if (submitted && !hasErrors) {
    return (
      <div className="mx-auto max-w-md rounded-md border border-[var(--color-status-ok)]/30 bg-[color-mix(in_oklch,var(--color-status-ok)_8%,transparent)] p-6 text-center">
        <CheckCircle size={28} weight="bold" aria-hidden="true" className="mx-auto text-[var(--color-status-ok)]" />
        <h1 className="mt-2 text-[18px] font-semibold">Producto guardado</h1>
        <p className="mt-1 text-[13px] text-[var(--color-ink-700)]">
          {form.nombre} · {form.sku}
        </p>
        <p className="mt-3 text-[11.5px] text-[var(--color-ink-500)]">
          Redirigiendo al inventario…
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <a href="/" className="inline-flex items-center gap-1 text-[12px] text-[var(--color-ink-500)] hover:text-[var(--color-ocean)]">
        <ArrowLeft size={12} weight="bold" aria-hidden="true" />
        Inventario
      </a>
      <header className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow">{mode === "create" ? "Alta" : "Edición"}</p>
          <h1 className="mt-1 text-[20px] font-semibold tracking-tight">
            {mode === "create" ? "Nuevo producto" : `Editar ${originalSku ?? "producto"}`}
          </h1>
        </div>
        {active ? (
          <span className="inline-flex items-center gap-2 text-[11px] text-[var(--color-ink-500)]">
            <span className="grid h-5 w-5 place-items-center rounded-[3px] bg-[var(--color-ocean)] font-mono text-[9px] font-semibold uppercase text-white">
              {active.nombre.split(/\s+/).slice(0, 2).map((w) => w[0]).join("")}
            </span>
            <span>Registrado por {active.nombre}</span>
          </span>
        ) : null}
      </header>

      <form noValidate onSubmit={onSubmit} className="mt-5 grid gap-4 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <CharCounter
          id="nombre"
          label="Nombre del producto"
          required
          value={form.nombre}
          max={LIMITS.nombre.max}
          error={showError("nombre") ? errors.nombre : undefined}
          hint="Como va a aparecer en la tabla y los reportes."
        >
          <input
            id="nombre"
            type="text"
            value={form.nombre}
            onChange={(e) => setField("nombre", e.target.value)}
            maxLength={LIMITS.nombre.max}
            aria-invalid={Boolean(showError("nombre")) || undefined}
            aria-describedby={showError("nombre") ? "nombre-error" : undefined}
            className={inputCls(showError("nombre"))}
          />
        </CharCounter>

        <div className="grid gap-4 sm:grid-cols-2">
          <CharCounter
            id="sku"
            label="SKU"
            required
            value={form.sku}
            max={LIMITS.sku.max}
            error={showError("sku") ? errors.sku : undefined}
            hint={mode === "create" ? `Sugerido: ${suggestedSku}` : undefined}
          >
            <input
              id="sku"
              type="text"
              value={form.sku}
              onChange={(e) => setField("sku", e.target.value.toUpperCase())}
              maxLength={LIMITS.sku.max}
              aria-invalid={Boolean(showError("sku")) || undefined}
              aria-describedby={showError("sku") ? "sku-error" : undefined}
              className={`mono ${inputCls(showError("sku"))}`}
            />
          </CharCounter>
          <CharCounter
            id="categoria"
            label="Categoría"
            required
            value={form.categoria}
            max={LIMITS.categoria.max}
            error={showError("categoria") ? errors.categoria : undefined}
            hint="Tipeá una nueva o elegí una existente."
          >
            <input
              id="categoria"
              type="text"
              value={form.categoria}
              onChange={(e) => setField("categoria", e.target.value)}
              maxLength={LIMITS.categoria.max}
              list="product-category-options"
              aria-invalid={Boolean(showError("categoria")) || undefined}
              aria-describedby={showError("categoria") ? "categoria-error" : undefined}
              className={inputCls(showError("categoria"))}
            />
            <datalist id="product-category-options">
              {categoryOptions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </CharCounter>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <Field id="stockActual" label="Stock actual" required error={showError("stockActual") ? errors.stockActual : undefined}>
            <input
              id="stockActual"
              type="number"
              min={0}
              value={form.stockActual}
              onChange={(e) => setField("stockActual", e.target.value)}
              aria-invalid={Boolean(showError("stockActual")) || undefined}
              aria-describedby={showError("stockActual") ? "stockActual-error" : undefined}
              className={`mono ${inputCls(showError("stockActual"))}`}
            />
          </Field>
          <Field id="stockMinimo" label="Stock mínimo" required error={showError("stockMinimo") ? errors.stockMinimo : undefined}>
            <input
              id="stockMinimo"
              type="number"
              min={0}
              value={form.stockMinimo}
              onChange={(e) => setField("stockMinimo", e.target.value)}
              aria-invalid={Boolean(showError("stockMinimo")) || undefined}
              aria-describedby={showError("stockMinimo") ? "stockMinimo-error" : undefined}
              className={`mono ${inputCls(showError("stockMinimo"))}`}
            />
          </Field>
          <Field id="unidad" label="Unidad" required>
            <select
              id="unidad"
              value={form.unidad}
              onChange={(e) => setField("unidad", e.target.value as FormState["unidad"])}
              className={inputCls(false)}
            >
              {UNIDAD_OPTIONS.map((u) => (<option key={u} value={u}>{u}</option>))}
            </select>
          </Field>
          <Field id="precioUnitario" label="Precio unitario (ARS)" required error={showError("precioUnitario") ? errors.precioUnitario : undefined}>
            <input
              id="precioUnitario"
              type="text"
              inputMode="decimal"
              value={form.precioUnitario}
              onChange={(e) => setField("precioUnitario", e.target.value)}
              aria-invalid={Boolean(showError("precioUnitario")) || undefined}
              aria-describedby={showError("precioUnitario") ? "precioUnitario-error" : undefined}
              className={`mono ${inputCls(showError("precioUnitario"))}`}
            />
          </Field>
        </div>

        <details className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-muted)] p-3">
          <summary className="cursor-pointer text-[12px] font-medium text-[var(--color-ink-700)]">
            Datos opcionales
            <span className="ml-2 text-[10.5px] font-normal text-[var(--color-ink-500)]">
              (notas, imagen)
            </span>
          </summary>
          <div className="mt-3 grid gap-4">
            <CharCounter
              id="notas"
              label="Notas"
              value={form.notas}
              max={LIMITS.notas.max}
              error={showError("notas") ? errors.notas : undefined}
              hint="Proveedor alternativo, ubicación en depósito, lote, vencimientos."
            >
              <textarea
                id="notas"
                rows={3}
                value={form.notas}
                onChange={(e) => setField("notas", e.target.value)}
                maxLength={LIMITS.notas.max}
                aria-invalid={Boolean(showError("notas")) || undefined}
                aria-describedby={showError("notas") ? "notas-error" : undefined}
                className={inputCls(showError("notas"), true)}
              />
            </CharCounter>
            <CharCounter
              id="imagenUrl"
              label="URL de imagen"
              value={form.imagenUrl}
              max={LIMITS.imagenUrl.max}
              error={showError("imagenUrl") ? errors.imagenUrl : undefined}
              hint="Foto del producto o etiqueta. http(s)://…"
            >
              <input
                id="imagenUrl"
                type="url"
                value={form.imagenUrl}
                onChange={(e) => setField("imagenUrl", e.target.value)}
                maxLength={LIMITS.imagenUrl.max}
                placeholder="https://…"
                aria-invalid={Boolean(showError("imagenUrl")) || undefined}
                aria-describedby={showError("imagenUrl") ? "imagenUrl-error" : undefined}
                className={`mono ${inputCls(showError("imagenUrl"))}`}
              />
            </CharCounter>
            {form.imagenUrl && isValidUrl(form.imagenUrl) ? (
              <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-2">
                <p className="mb-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-[var(--color-ink-500)]">
                  Vista previa
                </p>
                <img
                  src={form.imagenUrl}
                  alt=""
                  className="h-32 max-w-full rounded-sm border border-[var(--color-line)] object-contain"
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            ) : null}
          </div>
        </details>

        <div className="flex flex-col-reverse gap-2 border-t border-[var(--color-line)] pt-4 sm:flex-row sm:justify-end">
          <a href="/" className="btn-base h-10 border border-[var(--color-line)] bg-[var(--color-surface)] px-4 text-sm hover:bg-[var(--color-surface-muted)]">Cancelar</a>
          <button
            type="submit"
            disabled={!hydrated}
            className="btn-base h-10 bg-[var(--color-ocean)] px-4 text-sm font-medium text-white hover:bg-[var(--color-ocean-deep)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FloppyDisk size={14} weight="bold" aria-hidden="true" />
            {mode === "create" ? "Crear producto" : "Guardar cambios"}
          </button>
        </div>
      </form>

      {mode === "edit" && hydrated && !originalSku ? (
        <div role="alert" className="mt-6 rounded-md border border-[var(--color-status-bad)]/40 bg-[color-mix(in_oklch,var(--color-status-bad)_10%,transparent)] p-3 text-sm text-[var(--color-status-bad)]">
          No se encontró el producto con SKU <code className="font-mono">{skuProp ?? ""}</code>.
        </div>
      ) : null}

      {mode === "create" ? (
        <p className="mt-4 text-xs text-[var(--color-ink-500)]">
          Catálogo inicial con {SEED_PRODUCTS.length} productos demo. Si querés volver al estado de fábrica, usá "Restablecer" en el panel principal.
        </p>
      ) : null}
    </div>
  );
}

function inputCls(hasError: boolean, isTextarea = false): string {
  const base = `w-full rounded-md border bg-[var(--color-surface)] px-2.5 text-[13px] focus:outline-none ${
    hasError
      ? "border-[var(--color-status-bad)] focus:border-[var(--color-status-bad)]"
      : "border-[var(--color-line)] focus:border-[var(--color-focus)]"
  }`;
  return isTextarea
    ? `${base} py-2 leading-snug`
    : `${base} h-10`;
}

function Field({
  id, label, required, hint, error, children,
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
      <label htmlFor={id} className="mb-1.5 flex items-center justify-between text-xs font-medium text-[var(--color-ink-700)]">
        <span>
          {label}
          {required ? <span aria-hidden="true" className="ml-0.5 text-[var(--color-status-bad)]">*</span> : null}
        </span>
        {hint && !error ? <span className="text-[11px] font-normal text-[var(--color-ink-500)]">{hint}</span> : null}
      </label>
      {children}
      {error ? <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-[var(--color-status-bad)]">{error}</p> : null}
    </div>
  );
}

function CharCounter({
  id,
  label,
  required,
  value,
  max,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  max: number;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  const remaining = max - value.length;
  const nearLimit = remaining <= max * 0.15;
  const overLimit = remaining < 0;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-center justify-between gap-2 text-xs font-medium text-[var(--color-ink-700)]">
        <span>
          {label}
          {required ? <span aria-hidden="true" className="ml-0.5 text-[var(--color-status-bad)]">*</span> : null}
        </span>
        <span
          className={`mono text-[10.5px] tabular-nums ${
            overLimit
              ? "text-[var(--color-status-bad)]"
              : nearLimit
                ? "text-[var(--color-alert)]"
                : "text-[var(--color-ink-500)]"
          }`}
          aria-live="polite"
        >
          {value.length}/{max}
        </span>
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-[var(--color-status-bad)]">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-[var(--color-ink-500)]">{hint}</p>
      ) : null}
    </div>
  );
}
