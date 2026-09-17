import { useCallback, useMemo, useRef, useState } from "react";
import {
  CheckCircle,
  DownloadSimple,
  FileCsv,
  Spinner,
  UploadSimple,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import type { Category, Product } from "../data/seed";
import { formatNum } from "../lib/inventory";

// ---------------------------------------------------------------------------
// CSVImporter
//
// Modal que permite cargar productos desde un CSV. Sin dependencias externas:
// el parseo es 100% vanilla (RFC-4180 simplificado). .xlsx NO se soporta —
// el requisito es claro ("hecho a mano") y parsear XLSX sin librería no
// tiene sentido. El input acepta ambas extensiones para que el usuario no
// se frustre al elegir el archivo desde un selector de archivos del SO,
// pero si llega un binario .xlsx se rechaza con un mensaje claro.
//
// Columnas del CSV (orden libre, pero estas son las obligatorias):
//   sku, nombre, categoria, stockActual, stockMinimo, unidad, precioUnitario
//
// Persistencia: al confirmar, los productos validados se devuelven al padre
// vía `onImport(products[])`. El padre decide cómo mergearlos (en el
// Dashboard se concatenan con los existentes y se persisten en localStorage).
// ---------------------------------------------------------------------------

const REQUIRED_HEADERS = [
  "sku",
  "nombre",
  "categoria",
  "stockActual",
  "stockMinimo",
  "unidad",
  "precioUnitario",
] as const;

const VALID_CATEGORIES: Category[] = [
  "Arroz",
  "Fideos",
  "Aceite",
  "Legumbres",
  "Conservas",
  "Condimentos",
];

const VALID_UNIDADES = ["kg", "l", "un"] as const;

interface ParsedRow {
  /** índice de fila (1-based, contando desde la primera fila de datos) */
  index: number;
  raw: Record<string, string>;
  errors: string[];
  product?: Product;
}

interface ParseResult {
  headers: string[];
  rows: ParsedRow[];
  totalRows: number;
}

// ----------------------------------------------------------------------------
// Parser CSV vanilla — RFC 4180 lite: maneja quoted fields, comillas escapadas
// ("" → "), y saltos de línea \r\n / \n. NO procesa archivos binarios.
// ----------------------------------------------------------------------------
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

/**
 * Split en líneas que respeta CRLF dentro de quoted fields.
 * Iteramos carácter por carácter para no romper filas con saltos embebidos.
 */
function splitCsvRows(text: string): string[] {
  const rows: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '""';
        i++;
      } else {
        inQuotes = !inQuotes;
        cur += ch;
      }
    } else if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      rows.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.length > 0) rows.push(cur);
  return rows;
}

function parseCsvText(text: string): ParseResult {
  // Strip BOM si está presente.
  const cleaned = text.replace(/^\uFEFF/, "");
  const lines = splitCsvRows(cleaned).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [], totalRows: 0 };
  }
  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => {
      raw[h] = (fields[idx] ?? "").trim();
    });
    rows.push({ index: i, raw, errors: [] });
  }
  return { headers, rows, totalRows: rows.length };
}

// ----------------------------------------------------------------------------
// Validación
// ----------------------------------------------------------------------------
function validateRow(
  row: ParsedRow,
  headers: string[],
  existingSkus: Set<string>,
  seenInBatch: Set<string>,
): Product | null {
  const e = row.raw;
  const errors: string[] = [];

  // Headers faltantes
  for (const req of REQUIRED_HEADERS) {
    if (!headers.includes(req)) {
      errors.push(`Falta la columna "${req}" en el encabezado.`);
    }
  }
  if (errors.length > 0) {
    row.errors = errors;
    return null;
  }

  // SKU
  const sku = e.sku?.toUpperCase() ?? "";
  if (!sku) errors.push("SKU vacío.");
  else if (!/^[A-Z0-9-]{3,20}$/.test(sku))
    errors.push("SKU inválido (3-20 chars, letras/números/guion).");
  else if (existingSkus.has(sku)) errors.push(`SKU "${sku}" ya existe en el catálogo.`);
  else if (seenInBatch.has(sku)) errors.push(`SKU "${sku}" duplicado dentro del archivo.`);

  // Nombre
  const nombre = e.nombre ?? "";
  if (!nombre) errors.push("Nombre vacío.");
  else if (nombre.length < 3) errors.push("Nombre: mínimo 3 caracteres.");

  // Categoría
  const categoria = e.categoria ?? "";
  if (!categoria) errors.push("Categoría vacía.");
  else if (!VALID_CATEGORIES.includes(categoria as Category))
    errors.push(`Categoría "${categoria}" no válida.`);

  // Stock actual
  const stockActualStr = e.stockactual ?? "";
  const stockActual = Number(stockActualStr);
  if (!stockActualStr) errors.push("Stock actual vacío.");
  else if (!Number.isFinite(stockActual) || stockActual < 0 || !Number.isInteger(stockActual))
    errors.push("Stock actual: entero ≥ 0.");

  // Stock mínimo
  const stockMinimoStr = e.stockminimo ?? "";
  const stockMinimo = Number(stockMinimoStr);
  if (!stockMinimoStr) errors.push("Stock mínimo vacío.");
  else if (!Number.isFinite(stockMinimo) || stockMinimo < 0 || !Number.isInteger(stockMinimo))
    errors.push("Stock mínimo: entero ≥ 0.");

  // Unidad
  const unidad = (e.unidad ?? "").toLowerCase();
  if (!unidad) errors.push("Unidad vacía.");
  else if (!VALID_UNIDADES.includes(unidad as (typeof VALID_UNIDADES)[number]))
    errors.push(`Unidad "${unidad}" no válida (usar kg/l/un).`);

  // Precio unitario
  const precioStr = e.preciounitario ?? "";
  const precio = Number(precioStr);
  if (!precioStr) errors.push("Precio unitario vacío.");
  else if (!Number.isFinite(precio) || precio < 0)
    errors.push("Precio unitario: número ≥ 0.");

  if (errors.length > 0) {
    row.errors = errors;
    return null;
  }

  const product: Product = {
    sku,
    nombre,
    categoria: categoria as Category,
    stockActual,
    stockMinimo,
    unidad,
    precioUnitario: precio,
    actualizadoEn: new Date().toISOString().slice(0, 10),
    movimientos: [],
  };
  row.product = product;
  return product;
}

function validateAll(
  result: ParseResult,
  existingSkus: Set<string>,
): { valid: Product[]; rows: ParsedRow[] } {
  const seenInBatch = new Set<string>();
  const valid: Product[] = [];
  const rows: ParsedRow[] = [];
  for (const row of result.rows) {
    const product = validateRow(row, result.headers, existingSkus, seenInBatch);
    if (product) {
      seenInBatch.add(product.sku);
      valid.push(product);
      rows.push({ ...row, errors: [...row.errors], product });
    } else {
      rows.push({ ...row, errors: [...row.errors] });
    }
  }
  return { valid, rows };
}

// ----------------------------------------------------------------------------
// Plantilla CSV
// ----------------------------------------------------------------------------
const TEMPLATE_HEADERS = [
  "sku",
  "nombre",
  "categoria",
  "stockActual",
  "stockMinimo",
  "unidad",
  "precioUnitario",
];
const TEMPLATE_ROWS = [
  ["ARR-NVO-100", "Arroz nuevo 1 kg", "Arroz", "120", "40", "kg", "1950"],
  ["FID-NVO-101", "Fideos mostachol 500 g", "Fideos", "60", "50", "un", "1480"],
  ["ACE-NVO-102", "Aceite canola 1 l", "Aceite", "35", "25", "l", "4200"],
];

function buildTemplate(): string {
  const lines = [TEMPLATE_HEADERS.join(",")];
  for (const r of TEMPLATE_ROWS) {
    lines.push(r.map(quoteIfNeeded).join(","));
  }
  return lines.join("\n") + "\n";
}

function quoteIfNeeded(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadTemplate() {
  const csv = buildTemplate();
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla-inventario.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ----------------------------------------------------------------------------
// Componente
// ----------------------------------------------------------------------------
interface Props {
  open: boolean;
  existingProducts: Product[];
  onClose: () => void;
  onImport: (products: Product[]) => void;
}

export default function CSVImporter({
  open,
  existingProducts,
  onClose,
  onImport,
}: Props) {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [validatedRows, setValidatedRows] = useState<ParsedRow[] | null>(null);
  const [validProducts, setValidProducts] = useState<Product[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setParseResult(null);
    setValidatedRows(null);
    setValidProducts(null);
    setFileName(null);
    setFileError(null);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  function handleClose() {
    reset();
    onClose();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);
    setParseResult(null);
    setValidatedRows(null);
    setValidProducts(null);
    setFileName(file.name);

    // Rechazo binarios obvios (.xlsx es ZIP, empieza con "PK").
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      setFileError(
        "Por ahora solo se admiten archivos CSV. Desde Excel: Archivo → Guardar como → CSV (UTF-8).",
      );
      return;
    }
    if (!lower.endsWith(".csv") && !lower.endsWith(".txt")) {
      setFileError("Extensión no reconocida. Usá un archivo .csv.");
      return;
    }

    setReading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setReading(false);
      const text = String(reader.result ?? "");
      const result = parseCsvText(text);
      if (result.headers.length === 0) {
        setFileError("El archivo está vacío.");
        return;
      }
      const existingSkus = new Set(existingProducts.map((p) => p.sku));
      const { valid, rows } = validateAll(result, existingSkus);
      setParseResult(result);
      setValidatedRows(rows);
      setValidProducts(valid);
    };
    reader.onerror = () => {
      setReading(false);
      setFileError("No se pudo leer el archivo.");
    };
    reader.readAsText(file, "utf-8");
  }

  function handleConfirm() {
    if (!validProducts || validProducts.length === 0) {
      handleClose();
      return;
    }
    onImport(validProducts);
    reset();
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="csv-title"
      className="fixed inset-0 z-40 grid place-items-center bg-[var(--color-ink-900)]/50 p-4"
    >
      <div className="w-full max-w-3xl rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] shadow-xl">
        {/* Header */}
        <header className="flex items-center justify-between gap-2 border-b border-[var(--color-line)] px-5 py-3">
          <div className="flex items-center gap-2">
            <FileCsv size={18} weight="bold" aria-hidden="true" style={{ color: "var(--color-ocean)" }} />
            <h2 id="csv-title" className="text-base font-semibold text-[var(--color-ink-900)]">
              Importar productos desde CSV
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Cerrar"
            className="btn-base grid h-8 w-8 place-items-center text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)]"
          >
            <X size={14} weight="bold" />
          </button>
        </header>

        {/* Body */}
        <div className="space-y-4 p-5">
          {/* Step 1: input + template */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex-1 min-w-[200px]">
              <span className="sr-only">Archivo CSV</span>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls,.txt"
                onChange={handleFile}
                className="block w-full text-sm text-[var(--color-ink-700)] file:mr-3 file:rounded-md file:border file:border-[var(--color-line)] file:bg-[var(--color-surface-muted)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--color-ink-900)] hover:file:bg-[var(--color-ocean-soft)]"
              />
            </label>
            <button
              type="button"
              onClick={downloadTemplate}
              className="btn-base h-9 border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)]"
            >
              <DownloadSimple size={14} weight="bold" aria-hidden="true" />
              Descargar plantilla
            </button>
          </div>

          {/* File error */}
          {fileError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-[var(--color-status-bad)]/40 bg-[color-mix(in_oklch,var(--color-status-bad)_10%,transparent)] p-3 text-sm text-[var(--color-status-bad)]"
            >
              <WarningCircle size={16} weight="bold" aria-hidden="true" className="mt-0.5 shrink-0" />
              <span>{fileError}</span>
            </div>
          ) : null}

          {/* Reading state */}
          {reading ? (
            <div className="flex items-center gap-2 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-muted)] p-3 text-sm text-[var(--color-ink-700)]">
              <Spinner size={14} weight="bold" aria-hidden="true" className="animate-spin" />
              Leyendo archivo…
            </div>
          ) : null}

          {/* Step 2: preview + errors */}
          {parseResult && validatedRows && validProducts ? (
            <ImportSummary
              fileName={fileName ?? ""}
              rows={validatedRows}
              valid={validProducts}
            />
          ) : null}
        </div>

        {/* Footer */}
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-line)] bg-[var(--color-surface-muted)] px-5 py-3">
          <p className="text-xs text-[var(--color-ink-500)]">
            Columnas obligatorias:{" "}
            <span className="mono">{REQUIRED_HEADERS.join(", ")}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="btn-base h-9 border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!validProducts || validProducts.length === 0}
              className="btn-base h-9 bg-[var(--color-ocean)] px-3 text-sm font-medium text-white hover:bg-[var(--color-ocean-deep)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <UploadSimple size={14} weight="bold" aria-hidden="true" />
              Confirmar importación
              {validProducts && validProducts.length > 0 ? (
                <span className="mono ml-1">({formatNum(validProducts.length)})</span>
              ) : null}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Subcomponente: resumen + tabla de preview + lista de errores por fila
// ----------------------------------------------------------------------------
function ImportSummary({
  fileName,
  rows,
  valid,
}: {
  fileName: string;
  rows: ParsedRow[];
  valid: Product[];
}) {
  const totalRows = rows.length;
  const errorRows = rows.filter((r) => r.errors.length > 0);
  const previewRows = rows.slice(0, 5);

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Filas" value={totalRows} tone="neutral" />
        <Stat
          label="Válidas"
          value={valid.length}
          tone={valid.length > 0 ? "ok" : "neutral"}
        />
        <Stat
          label="Con errores"
          value={errorRows.length}
          tone={errorRows.length > 0 ? "bad" : "neutral"}
        />
      </div>

      {/* Success banner */}
      {valid.length > 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-[var(--color-status-ok)]/40 bg-[color-mix(in_oklch,var(--color-status-ok)_10%,transparent)] p-3 text-sm text-[var(--color-status-ok)]">
          <CheckCircle size={16} weight="bold" aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>
            <span className="font-medium">{formatNum(valid.length)}</span>{" "}
            producto{valid.length === 1 ? "" : "s"} listo
            {valid.length === 1 ? "" : "s"} para importar
            {errorRows.length > 0 ? (
              <>
                {" "}
                · <span className="font-medium">{formatNum(errorRows.length)}</span> con
                error{errorRows.length === 1 ? "" : "es"} que se descartarán
              </>
            ) : null}
            .
          </span>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-md border border-[var(--color-alert)]/40 bg-[color-mix(in_oklch,var(--color-alert)_10%,transparent)] p-3 text-sm text-[var(--color-alert)]">
          <WarningCircle size={16} weight="bold" aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>
            Ninguna fila pasó la validación. Corregí el archivo y volvé a
            intentarlo.
          </span>
        </div>
      )}

      {/* Preview table */}
      <div>
        <p className="eyebrow mb-1.5">
          Preview · primeras {Math.min(5, totalRows)} filas
        </p>
        <div className="overflow-x-auto rounded-md border border-[var(--color-line)]">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-[var(--color-surface-muted)] text-left text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--color-ink-500)]">
                <th className="px-2 py-1.5">#</th>
                <th className="px-2 py-1.5">SKU</th>
                <th className="px-2 py-1.5">Nombre</th>
                <th className="px-2 py-1.5">Cat.</th>
                <th className="px-2 py-1.5 text-right">Stock</th>
                <th className="px-2 py-1.5 text-right">Mín</th>
                <th className="px-2 py-1.5">Un.</th>
                <th className="px-2 py-1.5 text-right">Precio</th>
                <th className="px-2 py-1.5 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {previewRows.map((r) => {
                const ok = r.errors.length === 0 && r.product;
                return (
                  <tr key={r.index} className="dense-row">
                    <td className="px-2 py-1.5 text-[var(--color-ink-500)]">
                      <span className="mono">{r.index}</span>
                    </td>
                    <td className="mono px-2 py-1.5">{r.raw.sku || "—"}</td>
                    <td className="max-w-[14rem] truncate px-2 py-1.5">
                      {r.raw.nombre || "—"}
                    </td>
                    <td className="px-2 py-1.5">{r.raw.categoria || "—"}</td>
                    <td className="mono px-2 py-1.5 text-right">
                      {r.raw.stockactual || "—"}
                    </td>
                    <td className="mono px-2 py-1.5 text-right">
                      {r.raw.stockminimo || "—"}
                    </td>
                    <td className="px-2 py-1.5">{r.raw.unidad || "—"}</td>
                    <td className="mono px-2 py-1.5 text-right">
                      {r.raw.preciounitario || "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <span
                        className="mono inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em]"
                        style={
                          ok
                            ? {
                                color: "var(--color-status-ok)",
                                backgroundColor:
                                  "color-mix(in oklch, var(--color-status-ok) 14%, transparent)",
                                border:
                                  "1px solid color-mix(in oklch, var(--color-status-ok) 38%, transparent)",
                              }
                            : {
                                color: "var(--color-status-bad)",
                                backgroundColor:
                                  "color-mix(in oklch, var(--color-status-bad) 14%, transparent)",
                                border:
                                  "1px solid color-mix(in oklch, var(--color-status-bad) 38%, transparent)",
                              }
                        }
                      >
                        {ok ? "OK" : `${r.errors.length} error${r.errors.length === 1 ? "" : "es"}`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Error list */}
      {errorRows.length > 0 ? (
        <details className="rounded-md border border-[var(--color-status-bad)]/40 bg-[color-mix(in_oklch,var(--color-status-bad)_6%,transparent)]">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-[var(--color-status-bad)]">
            <WarningCircle
              size={14}
              weight="bold"
              aria-hidden="true"
              className="mr-1.5 inline-block align-text-bottom"
            />
            {formatNum(errorRows.length)} fila
            {errorRows.length === 1 ? "" : "s"} con errores
          </summary>
          <ul className="divide-y divide-[var(--color-line)] border-t border-[var(--color-status-bad)]/30">
            {errorRows.map((r) => (
              <li key={r.index} className="px-3 py-2 text-xs">
                <p className="flex items-center gap-2">
                  <span className="mono font-medium text-[var(--color-ink-900)]">
                    Fila {r.index}
                  </span>
                  <span className="mono text-[var(--color-ink-500)]">
                    {r.raw.sku || "(sin SKU)"}
                  </span>
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[var(--color-ink-700)]">
                  {r.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {/* Footer info */}
      <p className="text-[11px] text-[var(--color-ink-500)]">
        Archivo: <span className="mono">{fileName}</span>
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "ok" | "bad";
}) {
  const color =
    tone === "ok"
      ? "var(--color-status-ok)"
      : tone === "bad"
        ? "var(--color-status-bad)"
        : "var(--color-ink-900)";
  return (
    <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-2">
      <p
        className="mono text-lg font-semibold leading-none tracking-tight"
        style={{ color }}
      >
        {formatNum(value)}
      </p>
      <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--color-ink-500)]">
        {label}
      </p>
    </div>
  );
}
