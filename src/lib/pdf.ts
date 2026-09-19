import { formatArs, formatNum } from "./inventory";

// ---------------------------------------------------------------------------
// pdf.ts — helpers para exportar los reportes como PDF con jspdf.
//
// Usamos jspdf-autotable si está disponible para tablas bonitas; si no,
// dibujamos tablas con el jsPDF base. Como ambas librerías se cargan
// dinámicamente en ReportsView, las funciones reciben la clase jsPDF
// ya instanciada.
// ---------------------------------------------------------------------------

// Constructor tipado estructuralmente — los métodos que usamos deben existir
// en la instancia. Aceptamos la clase real de jspdf (que tiene overloads
// ligeramente distintos) mediante una intersección con `unknown`.
type JsPdfCtor = new (opts?: {
  orientation?: "portrait" | "landscape";
}) => JsPdfInstance;

interface JsPdfInternal {
  pageSize: { getWidth: () => number; getHeight: () => number };
  getNumberOfPages?: () => number;
}

interface JsPdfInstance {
  // El setFont real acepta un tercer argumento opcional (`fontWeight`).
  // Aceptamos ambos para mantener la firma compatible con la clase real
  // que nos llega desde `import("jspdf")`.
  setFont: (
    family?: string,
    style?: string,
    weight?: string | number,
  ) => JsPdfInstance;
  setFontSize: (size: number) => JsPdfInstance;
  setTextColor: (r: number, g: number, b: number) => JsPdfInstance;
  setFillColor: (r: number, g: number, b: number) => JsPdfInstance;
  setDrawColor: (r: number, g: number, b: number) => JsPdfInstance;
  text: (txt: string | string[], x: number, y: number, opts?: object) => JsPdfInstance;
  rect: (x: number, y: number, w: number, h: number, style?: string) => JsPdfInstance;
  line: (x1: number, y1: number, x2: number, y2: number) => JsPdfInstance;
  getLineHeight: () => number;
  internal: JsPdfInternal;
  addPage: () => JsPdfInstance;
  setPage: (pageNumber: number) => JsPdfInstance;
  save: (filename: string) => JsPdfInstance;
  output: (type?: "blob") => Blob;
}

type JsPdfAutoTableFn = (
  doc: JsPdfInstance,
  opts: {
    head?: string[][];
    body?: (string | number)[][];
    startY?: number;
    theme?: "grid" | "plain" | "striped";
    headStyles?: { fillColor?: [number, number, number]; textColor?: [number, number, number]; fontStyle?: string };
    styles?: { fontSize?: number; cellPadding?: number };
    columnStyles?: Record<string, { halign?: "left" | "right" | "center"; cellWidth?: number }>;
    margin?: { left?: number; right?: number };
  },
) => void;

interface AutoTableMod {
  default?: JsPdfAutoTableFn;
  applyPlugin?: (jsPdf: JsPdfCtor) => void;
}

export type { JsPdfCtor, AutoTableMod, JsPdfInstance, JsPdfAutoTableFn };

function brand(): string {
  return "Distribuidora El Faro";
}

function nowLabel(): string {
  const d = new Date();
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function header(doc: JsPdfInstance, title: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(10, 107, 140); // ocean
  doc.rect(0, 0, w, 28, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(brand(), 14, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(title, 14, 20);
  doc.setTextColor(45, 51, 56);
}

function footer(doc: JsPdfInstance) {
  const pageCount = doc.internal.getNumberOfPages?.() ?? 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 130, 140);
    doc.text(`${brand()} · ${nowLabel()}`, 14, h - 8);
    doc.text(`pág ${i} / ${pageCount}`, w - 30, h - 8);
  }
}

function registerAutoTable(
  jsPdf: JsPdfCtor,
  autoTableMod: AutoTableMod | null,
): JsPdfAutoTableFn | null {
  if (!autoTableMod) return null;
  // jspdf-autotable ships either as a default export, or has applyPlugin
  // for side-effect registration. We try both for robustness.
  if (typeof autoTableMod.applyPlugin === "function") {
    try { autoTableMod.applyPlugin(jsPdf); } catch { /* noop */ }
  }
  if (typeof autoTableMod.default === "function") {
    return autoTableMod.default;
  }
  // Try global side-effect attach.
  const anyGlobal = (globalThis as unknown as { jspdf?: { autoTable?: JsPdfAutoTableFn } }).jspdf;
  if (anyGlobal?.autoTable) return anyGlobal.autoTable;
  return null;
}

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

export function downloadStockCriticoPdf(
  JsPDF: JsPdfCtor,
  autoTableMod: AutoTableMod | null,
  rows: StockCriticoRow[],
) {
  const doc = new JsPDF({ orientation: "portrait" });
  header(doc, "Reporte · Stock crítico");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Productos en estado bajo o crítico", 14, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(85, 95, 105);
  doc.text(
    `${rows.length} productos requieren reposición. Generado ${nowLabel()}.`,
    14,
    48,
  );

  const autoTable = registerAutoTable(JsPDF, autoTableMod);
  if (autoTable) {
    autoTable(doc, {
      startY: 56,
      head: [["Estado", "SKU", "Producto", "Categoría", "Stock", "Faltan", "% del mín."]],
      body: rows.map((r) => [
        r.estado === "critico" ? "Crítico" : "Bajo",
        r.sku,
        r.nombre,
        r.categoria,
        `${formatNum(r.stockActual)} ${r.unidad}`,
        `${formatNum(r.faltan)} ${r.unidad}`,
        `${r.pctDelMinimo.toFixed(0)}%`,
      ]),
      headStyles: {
        fillColor: [10, 107, 140],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
      },
    });
  } else {
    // Fallback: tabla manual
    drawManualTable(
      doc,
      ["SKU", "Producto", "Stock", "Faltan", "%"],
      rows.map((r) => [
        r.sku,
        r.nombre,
        `${formatNum(r.stockActual)} ${r.unidad}`,
        `${formatNum(r.faltan)} ${r.unidad}`,
        `${r.pctDelMinimo.toFixed(0)}%`,
      ]),
    );
  }
  footer(doc);
  doc.save(`stock-critico-${Date.now()}.pdf`);
}

interface ValorRow {
  categoria: string;
  productos: number;
  stockTotal: number;
  valor: number;
  pctValor: number;
  bajoCount: number;
  criticoCount: number;
}

export function downloadValorizacionPdf(
  JsPDF: JsPdfCtor,
  autoTableMod: AutoTableMod | null,
  rows: ValorRow[],
  total: number,
) {
  const doc = new JsPDF({ orientation: "portrait" });
  header(doc, "Reporte · Valorización de inventario");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Valor por categoría", 14, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(85, 95, 105);
  doc.text(`Total: ${formatArs(total)}. ${rows.length} categorías.`, 14, 48);

  const autoTable = registerAutoTable(JsPDF, autoTableMod);
  if (autoTable) {
    autoTable(doc, {
      startY: 56,
      head: [["Categoría", "Productos", "Stock total", "Alertas", "Valor", "% del total"]],
      body: rows.map((r) => [
        r.categoria,
        formatNum(r.productos),
        formatNum(r.stockTotal),
        `${r.criticoCount}c / ${r.bajoCount}b`,
        formatArs(r.valor),
        `${r.pctValor.toFixed(1)}%`,
      ]),
      headStyles: {
        fillColor: [10, 107, 140],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "center" },
        4: { halign: "right" },
        5: { halign: "right" },
      },
    });
  } else {
    drawManualTable(
      doc,
      ["Categoría", "Prod.", "Valor", "%"],
      rows.map((r) => [
        r.categoria,
        formatNum(r.productos),
        formatArs(r.valor),
        `${r.pctValor.toFixed(1)}%`,
      ]),
    );
  }
  footer(doc);
  doc.save(`valorizacion-${Date.now()}.pdf`);
}

interface RotRow {
  sku: string;
  nombre: string;
  stockActual: number;
  unidad: string;
  ventas30d: number;
  promedioDiario: number;
  diasRestantes: number | null;
  estado: "sin_ventas" | "ok" | "alerta" | "critico";
}

export function downloadRotacionPdf(
  JsPDF: JsPdfCtor,
  autoTableMod: AutoTableMod | null,
  rows: RotRow[],
) {
  const doc = new JsPDF({ orientation: "portrait" });
  header(doc, "Reporte · Proyección de rotación");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Días de stock restantes (promedio 30d)", 14, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(85, 95, 105);
  doc.text(
    `Estimación basada en promedio de salidas. ${rows.length} productos.`,
    14,
    48,
  );

  const autoTable = registerAutoTable(JsPDF, autoTableMod);
  if (autoTable) {
    autoTable(doc, {
      startY: 56,
      head: [["SKU", "Producto", "Stock", "Ventas 30d", "Prom./día", "Días rest."]],
      body: rows.map((r) => [
        r.sku,
        r.nombre,
        `${formatNum(r.stockActual)} ${r.unidad}`,
        `${formatNum(r.ventas30d)} ${r.unidad}`,
        r.promedioDiario.toFixed(1),
        r.diasRestantes === null ? "—" : `${formatNum(r.diasRestantes)} d`,
      ]),
      headStyles: {
        fillColor: [10, 107, 140],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
      },
    });
  } else {
    drawManualTable(
      doc,
      ["SKU", "Producto", "Stock", "Días rest."],
      rows.map((r) => [
        r.sku,
        r.nombre,
        `${formatNum(r.stockActual)} ${r.unidad}`,
        r.diasRestantes === null ? "—" : `${formatNum(r.diasRestantes)}`,
      ]),
    );
  }
  footer(doc);
  doc.save(`rotacion-${Date.now()}.pdf`);
}

// ---------------------------------------------------------------------------
// Fallback manual: dibuja una tabla simple si autoTable no está disponible.
// ---------------------------------------------------------------------------

function drawManualTable(
  doc: JsPdfInstance,
  headers: string[],
  rows: string[][],
) {
  let y = 56;
  const pageW = doc.internal.pageSize.getWidth();
  const leftMargin = 14;
  const colCount = headers.length;
  const colW = (pageW - leftMargin * 2) / colCount;
  const rowH = 6;

  // Header
  doc.setFillColor(10, 107, 140);
  doc.rect(leftMargin, y, pageW - leftMargin * 2, rowH + 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  headers.forEach((h, i) => {
    doc.text(h, leftMargin + 2 + colW * i, y + 5);
  });
  y += rowH + 2;

  // Body
  doc.setFont("helvetica", "normal");
  doc.setTextColor(45, 51, 56);
  for (const row of rows) {
    if (y > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }
    row.forEach((cell, i) => {
      const text = String(cell);
      const trunc =
        text.length > 28 ? text.slice(0, 27) + "…" : text;
      doc.text(trunc, leftMargin + 2 + colW * i, y + 5);
    });
    doc.setDrawColor(225, 230, 235);
    doc.line(leftMargin, y + rowH, pageW - leftMargin, y + rowH);
    y += rowH;
  }
}
