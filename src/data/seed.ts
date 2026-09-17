// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Category =
  | "Arroz"
  | "Fideos"
  | "Aceite"
  | "Legumbres"
  | "Conservas"
  | "Condimentos";

export type StockStatus = "ok" | "bajo" | "critico";

export interface Product {
  /** Stable SKU, uppercase, e.g. "ARR-LAR-001" */
  sku: string;
  /** Display name */
  nombre: string;
  /** High-level category */
  categoria: Category;
  /** Current stock in declared unit (kg, l, un) */
  stockActual: number;
  /** Threshold (inclusive) below which the alert fires */
  stockMinimo: number;
  /** Unit of measure for stock numbers, e.g. "kg", "l", "un" */
  unidad: string;
  /** Unit cost in ARS — for estimated inventory value. Demo data. */
  precioUnitario: number;
  /** ISO date of last movement (informational, not editable) */
  actualizadoEn: string;
}

// ---------------------------------------------------------------------------
// Seed catalog
// ---------------------------------------------------------------------------
// 18 products, mixed stock states. Categories: Arroz, Fideos, Aceite, Legumbres,
// Conservas, Condimentos. Realistic SKUs, units and prices for an Argentine
// dry-foods distributor (demo data; prices are mock).
// ---------------------------------------------------------------------------

export const SEED_PRODUCTS: Product[] = [
  {
    sku: "ARR-LAR-001",
    nombre: "Arroz largo fino 1 kg",
    categoria: "Arroz",
    stockActual: 142,
    stockMinimo: 60,
    unidad: "kg",
    precioUnitario: 1850,
    actualizadoEn: "2026-09-12",
  },
  {
    sku: "ARR-DOB-002",
    nombre: "Arroz doble carolina 1 kg",
    categoria: "Arroz",
    stockActual: 38,
    stockMinimo: 40,
    unidad: "kg",
    precioUnitario: 2100,
    actualizadoEn: "2026-09-10",
  },
  {
    sku: "ARR-PAR-003",
    nombre: "Arroz parboiled 1 kg",
    categoria: "Arroz",
    stockActual: 7,
    stockMinimo: 25,
    unidad: "kg",
    precioUnitario: 2280,
    actualizadoEn: "2026-09-15",
  },
  {
    sku: "FID-ESP-010",
    nombre: "Fideos spaghetti 500 g",
    categoria: "Fideos",
    stockActual: 220,
    stockMinimo: 80,
    unidad: "un",
    precioUnitario: 1420,
    actualizadoEn: "2026-09-14",
  },
  {
    sku: "FID-TIR-011",
    nombre: "Fideos tirabuzón 500 g",
    categoria: "Fideos",
    stockActual: 18,
    stockMinimo: 60,
    unidad: "un",
    precioUnitario: 1390,
    actualizadoEn: "2026-09-11",
  },
  {
    sku: "FID-COD-012",
    nombre: "Fideos codito 500 g",
    categoria: "Fideos",
    stockActual: 64,
    stockMinimo: 60,
    unidad: "un",
    precioUnitario: 1390,
    actualizadoEn: "2026-09-09",
  },
  {
    sku: "FID-LAS-013",
    nombre: "Fideos lasaña 500 g",
    categoria: "Fideos",
    stockActual: 4,
    stockMinimo: 30,
    unidad: "un",
    precioUnitario: 1980,
    actualizadoEn: "2026-09-16",
  },
  {
    sku: "ACE-GIR-020",
    nombre: "Aceite girasol 1.5 l",
    categoria: "Aceite",
    stockActual: 96,
    stockMinimo: 50,
    unidad: "l",
    precioUnitario: 3850,
    actualizadoEn: "2026-09-12",
  },
  {
    sku: "ACE-OLI-021",
    nombre: "Aceite oliva extra virgen 500 ml",
    categoria: "Aceite",
    stockActual: 22,
    stockMinimo: 24,
    unidad: "l",
    precioUnitario: 8900,
    actualizadoEn: "2026-09-13",
  },
  {
    sku: "ACE-MIX-022",
    nombre: "Aceite mezcla 1 l",
    categoria: "Aceite",
    stockActual: 11,
    stockMinimo: 35,
    unidad: "l",
    precioUnitario: 2950,
    actualizadoEn: "2026-09-15",
  },
  {
    sku: "LEG-LEN-030",
    nombre: "Lentejas 500 g",
    categoria: "Legumbres",
    stockActual: 145,
    stockMinimo: 70,
    unidad: "kg",
    precioUnitario: 2680,
    actualizadoEn: "2026-09-08",
  },
  {
    sku: "LEG-GAR-031",
    nombre: "Garbanzos 500 g",
    categoria: "Legumbres",
    stockActual: 53,
    stockMinimo: 55,
    unidad: "kg",
    precioUnitario: 2840,
    actualizadoEn: "2026-09-12",
  },
  {
    sku: "LEG- POR-032",
    nombre: "Porotos negros 500 g",
    categoria: "Legumbres",
    stockActual: 9,
    stockMinimo: 40,
    unidad: "kg",
    precioUnitario: 3120,
    actualizadoEn: "2026-09-14",
  },
  {
    sku: "LEG-ARV-033",
    nombre: "Arvejas secas 500 g",
    categoria: "Legumbres",
    stockActual: 28,
    stockMinimo: 30,
    unidad: "kg",
    precioUnitario: 2410,
    actualizadoEn: "2026-09-10",
  },
  {
    sku: "CON-TOM-040",
    nombre: "Tomate perita en lata 400 g",
    categoria: "Conservas",
    stockActual: 184,
    stockMinimo: 70,
    unidad: "un",
    precioUnitario: 1620,
    actualizadoEn: "2026-09-07",
  },
  {
    sku: "CON-ATU-041",
    nombre: "Atún en aceite lata 170 g",
    categoria: "Conservas",
    stockActual: 12,
    stockMinimo: 45,
    unidad: "un",
    precioUnitario: 2950,
    actualizadoEn: "2026-09-15",
  },
  {
    sku: "CON-DUR-042",
    nombre: "Duraznos en lata 820 g",
    categoria: "Conservas",
    stockActual: 46,
    stockMinimo: 25,
    unidad: "un",
    precioUnitario: 3280,
    actualizadoEn: "2026-09-11",
  },
  {
    sku: "CON-SAL-050",
    nombre: "Sal fina 500 g",
    categoria: "Condimentos",
    stockActual: 88,
    stockMinimo: 40,
    unidad: "un",
    precioUnitario: 980,
    actualizadoEn: "2026-09-09",
  },
  {
    sku: "CON-PIM-051",
    nombre: "Pimienta negra molida 50 g",
    categoria: "Condimentos",
    stockActual: 6,
    stockMinimo: 20,
    unidad: "un",
    precioUnitario: 2150,
    actualizadoEn: "2026-09-16",
  },
];
