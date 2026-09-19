// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Category =
  | "Arroz"
  | "Fideos"
  | "Aceite"
  | "Legumbres"
  | "Conservas"
  | "Condimentos"
  | "Snacks"
  | "Bebidas"
  | "Lácteos"
  | "Limpieza";

export type StockStatus = "ok" | "bajo" | "critico";

/**
 * Tipos de movimiento de stock.
 * - "entrada": suma stock (compra, reposición, devolución).
 * - "salida":  resta stock (venta, consumo interno).
 * - "ajuste":  corrige stock (conteo físico, merma). Cantidad con signo.
 */
export type MovementType = "entrada" | "salida" | "ajuste";

export interface Movimiento {
  fecha: string;
  tipo: MovementType;
  cantidad: number;
  motivo: string;
  usuario: string;
}

export interface Product {
  sku: string;
  nombre: string;
  /**
   * Categoría libre del producto. Las categorías iniciales son las del
   * tipo `Category`; desde v2.1 el usuario puede crear/eliminar categorías
   * dinámicamente, por eso el campo es `string` en el tipo final.
   */
  categoria: string;
  stockActual: number;
  stockMinimo: number;
  unidad: string;
  precioUnitario: number;
  actualizadoEn: string;
  proveedorId?: string;
  movimientos?: Movimiento[];
  /** Notas libres del producto (proveedor, ubicación, particularidades). */
  notas?: string;
  /** URL pública a una imagen del producto (etiqueta, foto, packaging). */
  imagenUrl?: string;
}

/** Operario / usuario del sistema (mock multi-user). */
export interface Operario {
  id: string;
  nombre: string;
  rol: "Dueño" | "Encargado" | "Repositor" | "Cadete";
  color: string;
}

/** Proveedor que surte productos a la distribuidora. */
export interface Proveedor {
  id: string;
  nombre: string;
  contacto: string;
  telefono: string;
  email: string;
  skus: string[];
  ultimaOrden: string | null;
}

/** Orden de compra generada a un proveedor. */
export interface OrdenCompra {
  id: string;
  proveedorId: string;
  fecha: string;
  fechaEstimada: string;
  estado: "borrador" | "enviada" | "recibida" | "cancelada";
  lineas: { sku: string; cantidad: number; precioUnitario: number }[];
  operario: string;
  nota?: string;
}

/** Entrada de auditoría (log inmutable de operaciones relevantes). */
export interface AuditEntry {
  id: string;
  fecha: string;
  operario: string;
accion:
    | "alta_producto"
    | "edicion_producto"
    | "eliminacion_producto"
    | "ajuste_stock"
    | "stock_adjust"
    | "stock_set"
    | "stock_reset"
    | "movimiento_manual"
    | "importacion_csv"
    | "orden_compra_creada"
    | "orden_compra_recibida"
    | "reset_catalogo";
  detalle: string;
  sku?: string;
}

// ---------------------------------------------------------------------------
// Seed operators (mock multi-user)
// ---------------------------------------------------------------------------

export const SEED_OPERARIOS: Operario[] = [
  { id: "op-1", nombre: "Mariano Vega",   rol: "Dueño",      color: "oklch(0.55 0.115 222)" },
  { id: "op-2", nombre: "Lucía Romero",   rol: "Encargado",  color: "oklch(0.55 0.135 152)" },
  { id: "op-3", nombre: "Diego Salazar",  rol: "Repositor",  color: "oklch(0.74 0.135 71)"  },
  { id: "op-4", nombre: "Camila Torres",  rol: "Cadete",     color: "oklch(0.55 0.19 28)"   },
];

// ---------------------------------------------------------------------------
// Seed suppliers
// ---------------------------------------------------------------------------

export const SEED_PROVEEDORES: Proveedor[] = [
  { id: "prov-1", nombre: "Molinos del Plata SA",     contacto: "Hernán Sosa",     telefono: "+54 11 4321-7800", email: "ventas@molinosdelplata.com.ar",   skus: ["ARR-LAR-001","ARR-DOB-002","ARR-PAR-003","FID-ESP-010","FID-TIR-011","FID-COD-012","FID-LAS-013"], ultimaOrden: "2026-09-05" },
  { id: "prov-2", nombre: "Aceitera del Litoral",     contacto: "Patricia Méndez", telefono: "+54 11 4555-2240", email: "pedidos@aceiteralitoral.com",      skus: ["ACE-GIR-020","ACE-OLI-021","ACE-MIX-022"],                                                            ultimaOrden: "2026-09-02" },
  { id: "prov-3", nombre: "Legumbres Argentinas SRL", contacto: "Jorge Báez",      telefono: "+54 11 4221-9933", email: "jbanez@legumbresarg.com.ar",       skus: ["LEG-LEN-030","LEG-GAR-031","LEG-POR-032","LEG-ARV-033"],                                            ultimaOrden: "2026-08-28" },
  { id: "prov-4", nombre: "Conservas Faro",          contacto: "Mariana Iturbe",  telefono: "+54 221 445-1100", email: "comercial@conservasfaro.com",      skus: ["CON-TOM-040","CON-ATU-041","CON-DUR-042"],                                                          ultimaOrden: "2026-09-10" },
  { id: "prov-5", nombre: "Especias La Serrana",      contacto: "Andrés López",    telefono: "+54 11 4677-3311", email: "alopez@laserrana.com.ar",          skus: ["CON-SAL-050","CON-PIM-051","CON-OREG-052","CON-COM-053"],                                          ultimaOrden: "2026-09-08" },
  { id: "prov-6", nombre: "Snacks Faro SA",           contacto: "Sofía Carballo",  telefono: "+54 11 4899-2004", email: "sofia@snacksfaro.com.ar",          skus: ["SNK-PAP-060","SNK-CHI-061","SNK-MAN-062","SNK-GAL-063"],                                            ultimaOrden: "2026-09-14" },
  { id: "prov-7", nombre: "Bebidas Argentinas SA",    contacto: "Federico Galván", telefono: "+54 11 4556-7700", email: "fgalvan@bebidasarg.com",           skus: ["BEB-COC-070","BEB-AGU-071","BEB-GAS-072","BEB-CER-073"],                                            ultimaOrden: "2026-09-12" },
  { id: "prov-8", nombre: "Lácteos Pampa Húmeda",     contacto: "Roxana Páez",     telefono: "+54 221 442-5588", email: "rpaez@pampahumeda.com",            skus: ["LAC-LECH-080","LAC-YOG-081","LAC-QUE-082"],                                                          ultimaOrden: "2026-09-11" },
];

// ---------------------------------------------------------------------------
// Seed catalog — 32 products
// ---------------------------------------------------------------------------

export const SEED_PRODUCTS: Product[] = [
  // Arroz
  { sku: "ARR-LAR-001",   nombre: "Arroz largo fino 1 kg",          categoria: "Arroz",      stockActual: 142, stockMinimo: 60, unidad: "kg", precioUnitario: 1850, actualizadoEn: "2026-09-12", proveedorId: "prov-1" },
  { sku: "ARR-DOB-002",   nombre: "Arroz doble carolina 1 kg",      categoria: "Arroz",      stockActual:  38, stockMinimo: 40, unidad: "kg", precioUnitario: 2100, actualizadoEn: "2026-09-10", proveedorId: "prov-1" },
  { sku: "ARR-PAR-003",   nombre: "Arroz parboiled 1 kg",           categoria: "Arroz",      stockActual:   7, stockMinimo: 25, unidad: "kg", precioUnitario: 2280, actualizadoEn: "2026-09-15", proveedorId: "prov-1" },
  // Fideos
  { sku: "FID-ESP-010",   nombre: "Fideos spaghetti 500 g",         categoria: "Fideos",     stockActual: 220, stockMinimo: 80, unidad: "un", precioUnitario: 1420, actualizadoEn: "2026-09-14", proveedorId: "prov-1" },
  { sku: "FID-TIR-011",   nombre: "Fideos tirabuzón 500 g",         categoria: "Fideos",     stockActual:  18, stockMinimo: 60, unidad: "un", precioUnitario: 1390, actualizadoEn: "2026-09-11", proveedorId: "prov-1" },
  { sku: "FID-COD-012",   nombre: "Fideos codito 500 g",            categoria: "Fideos",     stockActual:  64, stockMinimo: 60, unidad: "un", precioUnitario: 1390, actualizadoEn: "2026-09-09", proveedorId: "prov-1" },
  { sku: "FID-LAS-013",   nombre: "Fideos lasaña 500 g",            categoria: "Fideos",     stockActual:   4, stockMinimo: 30, unidad: "un", precioUnitario: 1980, actualizadoEn: "2026-09-16", proveedorId: "prov-1" },
  // Aceite
  { sku: "ACE-GIR-020",   nombre: "Aceite girasol 1.5 l",           categoria: "Aceite",     stockActual:  96, stockMinimo: 50, unidad: "l",  precioUnitario: 3850, actualizadoEn: "2026-09-12", proveedorId: "prov-2" },
  { sku: "ACE-OLI-021",   nombre: "Aceite oliva extra virgen 500 ml", categoria: "Aceite",   stockActual:  22, stockMinimo: 24, unidad: "l",  precioUnitario: 8900, actualizadoEn: "2026-09-13", proveedorId: "prov-2" },
  { sku: "ACE-MIX-022",   nombre: "Aceite mezcla 1 l",              categoria: "Aceite",     stockActual:  11, stockMinimo: 35, unidad: "l",  precioUnitario: 2950, actualizadoEn: "2026-09-15", proveedorId: "prov-2" },
  // Legumbres
  { sku: "LEG-LEN-030",   nombre: "Lentejas 500 g",                 categoria: "Legumbres",  stockActual: 145, stockMinimo: 70, unidad: "kg", precioUnitario: 2680, actualizadoEn: "2026-09-08", proveedorId: "prov-3" },
  { sku: "LEG-GAR-031",   nombre: "Garbanzos 500 g",                categoria: "Legumbres",  stockActual:  53, stockMinimo: 55, unidad: "kg", precioUnitario: 2840, actualizadoEn: "2026-09-12", proveedorId: "prov-3" },
  { sku: "LEG-POR-032",   nombre: "Porotos negros 500 g",           categoria: "Legumbres",  stockActual:   9, stockMinimo: 40, unidad: "kg", precioUnitario: 3120, actualizadoEn: "2026-09-14", proveedorId: "prov-3" },
  { sku: "LEG-ARV-033",   nombre: "Arvejas secas 500 g",            categoria: "Legumbres",  stockActual:  28, stockMinimo: 30, unidad: "kg", precioUnitario: 2410, actualizadoEn: "2026-09-10", proveedorId: "prov-3" },
  // Conservas
  { sku: "CON-TOM-040",   nombre: "Tomate perita en lata 400 g",    categoria: "Conservas",  stockActual: 184, stockMinimo: 70, unidad: "un", precioUnitario: 1620, actualizadoEn: "2026-09-07", proveedorId: "prov-4" },
  { sku: "CON-ATU-041",   nombre: "Atún en aceite lata 170 g",      categoria: "Conservas",  stockActual:  12, stockMinimo: 45, unidad: "un", precioUnitario: 2950, actualizadoEn: "2026-09-15", proveedorId: "prov-4" },
  { sku: "CON-DUR-042",   nombre: "Duraznos en lata 820 g",         categoria: "Conservas",  stockActual:  46, stockMinimo: 25, unidad: "un", precioUnitario: 3280, actualizadoEn: "2026-09-11", proveedorId: "prov-4" },
  // Condimentos
  { sku: "CON-SAL-050",   nombre: "Sal fina 500 g",                 categoria: "Condimentos", stockActual: 88, stockMinimo: 40, unidad: "un", precioUnitario:  980, actualizadoEn: "2026-09-09", proveedorId: "prov-5" },
  { sku: "CON-PIM-051",   nombre: "Pimienta negra molida 50 g",     categoria: "Condimentos", stockActual:  6, stockMinimo: 20, unidad: "un", precioUnitario: 2150, actualizadoEn: "2026-09-16", proveedorId: "prov-5" },
  { sku: "CON-OREG-052",  nombre: "Orégano 25 g",                   categoria: "Condimentos", stockActual: 34, stockMinimo: 15, unidad: "un", precioUnitario: 1320, actualizadoEn: "2026-09-06", proveedorId: "prov-5" },
  { sku: "CON-COM-053",   nombre: "Comino molido 50 g",             categoria: "Condimentos", stockActual: 19, stockMinimo: 18, unidad: "un", precioUnitario: 1620, actualizadoEn: "2026-09-05", proveedorId: "prov-5" },
  // Snacks
  { sku: "SNK-PAP-060",   nombre: "Papas fritas clásicas 150 g",    categoria: "Snacks",     stockActual:  78, stockMinimo: 35, unidad: "un", precioUnitario: 1850, actualizadoEn: "2026-09-13", proveedorId: "prov-6" },
  { sku: "SNK-CHI-061",   nombre: "Chizitos 100 g",                 categoria: "Snacks",     stockActual: 124, stockMinimo: 50, unidad: "un", precioUnitario: 1490, actualizadoEn: "2026-09-12", proveedorId: "prov-6" },
  { sku: "SNK-MAN-062",   nombre: "Maní salado 200 g",              categoria: "Snacks",     stockActual:  16, stockMinimo: 30, unidad: "un", precioUnitario: 1980, actualizadoEn: "2026-09-16", proveedorId: "prov-6" },
  { sku: "SNK-GAL-063",   nombre: "Galletitas dulces 200 g",        categoria: "Snacks",     stockActual:  92, stockMinimo: 40, unidad: "un", precioUnitario: 1690, actualizadoEn: "2026-09-10", proveedorId: "prov-6" },
  // Bebidas
  { sku: "BEB-COC-070",   nombre: "Gaseosa cola 1.5 l",             categoria: "Bebidas",    stockActual: 156, stockMinimo: 60, unidad: "un", precioUnitario: 2480, actualizadoEn: "2026-09-11", proveedorId: "prov-7" },
  { sku: "BEB-AGU-071",   nombre: "Agua mineral sin gas 1.5 l",     categoria: "Bebidas",    stockActual: 210, stockMinimo: 80, unidad: "un", precioUnitario: 1280, actualizadoEn: "2026-09-09", proveedorId: "prov-7" },
  { sku: "BEB-GAS-072",   nombre: "Agua mineral con gas 1.5 l",     categoria: "Bebidas",    stockActual:  88, stockMinimo: 35, unidad: "un", precioUnitario: 1340, actualizadoEn: "2026-09-10", proveedorId: "prov-7" },
  { sku: "BEB-CER-073",   nombre: "Cerveza en lata 473 ml",         categoria: "Bebidas",    stockActual:  24, stockMinimo: 48, unidad: "un", precioUnitario: 1850, actualizadoEn: "2026-09-15", proveedorId: "prov-7" },
  // Lácteos
  { sku: "LAC-LECH-080",  nombre: "Leche UAT entera 1 l",           categoria: "Lácteos",    stockActual:  64, stockMinimo: 30, unidad: "un", precioUnitario: 1980, actualizadoEn: "2026-09-12", proveedorId: "prov-8" },
  { sku: "LAC-YOG-081",   nombre: "Yogurt bebible 1 l",             categoria: "Lácteos",    stockActual:  42, stockMinimo: 25, unidad: "un", precioUnitario: 2450, actualizadoEn: "2026-09-11", proveedorId: "prov-8" },
  { sku: "LAC-QUE-082",   nombre: "Queso crema 300 g",              categoria: "Lácteos",    stockActual:   8, stockMinimo: 20, unidad: "un", precioUnitario: 3680, actualizadoEn: "2026-09-16", proveedorId: "prov-8" },
];

// ---------------------------------------------------------------------------
// Seed movimientos (histórico)
// ---------------------------------------------------------------------------
// Generador procedural: para cada producto, se crean N movimientos
// distribuidos en los últimos 60 días, mezclando entradas (reposiciones)
// y salidas (ventas). El objetivo es que el dashboard y los reportes
// tengan volumen de datos realista.
// ---------------------------------------------------------------------------

function buildSeedMovimientos(products: Product[]): Product[] {
  const now = new Date("2026-09-17T18:00:00.000Z").getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  // Deterministic pseudo-random so seeds reproduce identically.
  let rng = 1234567;
  const rand = () => {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff;
    return rng / 0x7fffffff;
  };

  const motivosEntrada = [
    "Reposición semanal",
    "Compra a proveedor",
    "Devolución cliente",
    "Reposición mensual",
    "Reposición urgente",
  ];
  const motivosSalida = [
    "Venta mostrador",
    "Venta mayorista",
    "Pedido WhatsApp",
    "Venta mostrador",
    "Consumo interno",
  ];

  const out: Product[] = [];
  for (const p of products) {
    const isAlta = p.stockActual > p.stockMinimo * 1.4;
    const targetCount = isAlta ? 14 + Math.floor(rand() * 6) : 4 + Math.floor(rand() * 4);
    const moves: Movimiento[] = [];
    let reconstructed = 0;
    for (let i = 0; i < targetCount; i++) {
      const diasAtras = Math.floor(rand() * 60) + 1;
      const fechaMs = now - diasAtras * dayMs - Math.floor(rand() * dayMs);
      const fechaIso = new Date(fechaMs).toISOString();
      const isEntrada = rand() < 0.45;
      const cantidadBase = Math.max(1, Math.floor(p.stockMinimo * (0.05 + rand() * 0.3)));
      const cantidad = isEntrada ? cantidadBase : -cantidadBase;
      reconstructed += cantidad;
      const opR = rand();
      const usuario =
        opR < 0.25 ? "Mariano Vega" :
        opR < 0.5  ? "Lucía Romero" :
        opR < 0.75 ? "Diego Salazar" : "Camila Torres";
      moves.push({
        fecha: fechaIso,
        tipo: isEntrada ? "entrada" : "salida",
        cantidad,
        motivo: isEntrada
          ? motivosEntrada[Math.floor(rand() * motivosEntrada.length)]
          : motivosSalida[Math.floor(rand() * motivosSalida.length)],
        usuario,
      });
    }
    moves.sort((a, b) => b.fecha.localeCompare(a.fecha));
    const drift = p.stockActual - reconstructed;
    if (drift !== 0) {
      moves.unshift({
        fecha: new Date(now - 1 * dayMs).toISOString(),
        tipo: drift > 0 ? "entrada" : "ajuste",
        cantidad: drift,
        motivo: "Conteo físico inicial",
        usuario: "Mariano Vega",
      });
    }
    out.push({ ...p, movimientos: moves });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Seed audit log (≥ 30 entradas)
// ---------------------------------------------------------------------------

function buildSeedAudit(): AuditEntry[] {
  const now = new Date("2026-09-17T18:00:00.000Z").getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const make = (
    id: string,
    diasAtras: number,
    operario: string,
    accion: AuditEntry["accion"],
    detalle: string,
    sku?: string,
  ): AuditEntry => ({
    id,
    fecha: new Date(now - diasAtras * dayMs).toISOString(),
    operario,
    accion,
    detalle,
    sku,
  });

  return [
    make("a-001", 0.2,  "Mariano Vega",  "ajuste_stock",         "Sumó 24 kg a ARR-LAR-001 (Reposición semanal)", "ARR-LAR-001"),
    make("a-002", 0.5,  "Lucía Romero",  "ajuste_stock",         "Restó 12 un de FID-ESP-010 (Venta mayorista)", "FID-ESP-010"),
    make("a-003", 0.7,  "Diego Salazar", "movimiento_manual",    "Registró merma de 3 un de BEB-CER-073", "BEB-CER-073"),
    make("a-004", 1.0,  "Mariano Vega",  "orden_compra_creada",  "Orden de compra #OC-2026-0041 a Molinos del Plata SA"),
    make("a-005", 1.1,  "Camila Torres", "ajuste_stock",         "Sumó 36 l de ACE-GIR-020 (Reposición semanal)", "ACE-GIR-020"),
    make("a-006", 1.4,  "Lucía Romero",  "edicion_producto",     "Actualizó precio de CON-SAL-050 a ARS 980", "CON-SAL-050"),
    make("a-007", 1.6,  "Mariano Vega",  "alta_producto",        "Creó producto BEB-CER-073 (Cerveza en lata 473 ml)", "BEB-CER-073"),
    make("a-008", 1.9,  "Diego Salazar", "ajuste_stock",         "Sumó 50 un de CON-TOM-040 (Compra a proveedor)", "CON-TOM-040"),
    make("a-009", 2.1,  "Lucía Romero",  "orden_compra_recibida","Recibió orden #OC-2026-0038 de Conservas Faro"),
    make("a-010", 2.3,  "Camila Torres", "ajuste_stock",         "Restó 8 un de SNK-CHI-061 (Venta mostrador)", "SNK-CHI-061"),
    make("a-011", 2.7,  "Mariano Vega",  "edicion_producto",     "Subió stock mínimo de LEG-GAR-031 a 55", "LEG-GAR-031"),
    make("a-012", 3.0,  "Diego Salazar", "ajuste_stock",         "Sumó 24 kg de LEG-LEN-030 (Reposición mensual)", "LEG-LEN-030"),
    make("a-013", 3.4,  "Lucía Romero",  "importacion_csv",      "Importó catálogo inicial desde CSV (19 filas)"),
    make("a-014", 3.6,  "Mariano Vega",  "alta_producto",        "Creó producto LAC-QUE-082 (Queso crema 300 g)", "LAC-QUE-082"),
    make("a-015", 4.0,  "Camila Torres", "ajuste_stock",         "Restó 5 un de SNK-MAN-062 (Venta mostrador)", "SNK-MAN-062"),
    make("a-016", 4.3,  "Lucía Romero",  "orden_compra_creada",  "Orden de compra #OC-2026-0040 a Bebidas Argentinas SA"),
    make("a-017", 4.7,  "Diego Salazar", "movimiento_manual",    "Registró conteo físico: ajuste +2 kg en LEG-POR-032", "LEG-POR-032"),
    make("a-018", 5.0,  "Mariano Vega",  "edicion_producto",     "Cambió unidad de CON-PIM-051 a un"),
    make("a-019", 5.4,  "Lucía Romero",  "ajuste_stock",         "Sumó 24 l de ACE-OLI-021 (Compra a proveedor)", "ACE-OLI-021"),
    make("a-020", 5.8,  "Camila Torres", "ajuste_stock",         "Restó 18 un de LAC-LECH-080 (Pedido WhatsApp)", "LAC-LECH-080"),
    make("a-021", 6.1,  "Mariano Vega",  "eliminacion_producto", "Eliminó producto LEG-POR-031 (SKU duplicado)", "LEG-POR-031"),
    make("a-022", 6.5,  "Diego Salazar", "ajuste_stock",         "Sumó 30 un de BEB-AGU-071 (Reposición semanal)", "BEB-AGU-071"),
    make("a-023", 7.0,  "Lucía Romero",  "orden_compra_recibida","Recibió orden #OC-2026-0037 de Legumbres Argentinas SRL"),
    make("a-024", 7.4,  "Mariano Vega",  "alta_producto",        "Creó producto BEB-GAS-072 (Agua mineral con gas 1.5 l)", "BEB-GAS-072"),
    make("a-025", 8.0,  "Camila Torres", "ajuste_stock",         "Restó 4 un de CON-ATU-041 (Venta mostrador)", "CON-ATU-041"),
    make("a-026", 8.6,  "Diego Salazar", "ajuste_stock",         "Sumó 18 un de CON-OREG-052 (Reposición semanal)", "CON-OREG-052"),
    make("a-027", 9.2,  "Lucía Romero",  "edicion_producto",     "Actualizó precio de ACE-OLI-021 a ARS 8900", "ACE-OLI-021"),
    make("a-028", 10.0, "Mariano Vega",  "orden_compra_creada",  "Orden de compra #OC-2026-0036 a Lácteos Pampa Húmeda"),
    make("a-029", 11.5, "Diego Salazar", "ajuste_stock",         "Sumó 24 un de FID-COD-012 (Reposición semanal)", "FID-COD-012"),
    make("a-030", 12.8, "Lucía Romero",  "reset_catalogo",       "Restableció el catálogo al estado seed"),
    make("a-031", 14.0, "Mariano Vega",  "alta_producto",        "Creó producto SNK-GAL-063 (Galletitas dulces 200 g)", "SNK-GAL-063"),
    make("a-032", 16.5, "Camila Torres", "ajuste_stock",         "Restó 6 un de CON-PIM-051 (Venta mostrador)", "CON-PIM-051"),
  ];
}

// ---------------------------------------------------------------------------
// Final seed exports (productos con movimientos incrustados)
// ---------------------------------------------------------------------------

export const SEED_PRODUCTS_WITH_MOVS: Product[] = buildSeedMovimientos(SEED_PRODUCTS);

export const SEED_AUDIT: AuditEntry[] = buildSeedAudit();

export const SEED_ORDENES: OrdenCompra[] = [
  {
    id: "OC-2026-0041",
    proveedorId: "prov-1",
    fecha: "2026-09-17",
    fechaEstimada: "2026-09-22",
    estado: "enviada",
    operario: "Mariano Vega",
    lineas: [
      { sku: "ARR-LAR-001", cantidad: 80,  precioUnitario: 1750 },
      { sku: "FID-ESP-010", cantidad: 100, precioUnitario: 1320 },
      { sku: "FID-LAS-013", cantidad: 40,  precioUnitario: 1880 },
    ],
    nota: "Reposición mensual arroz y fideos.",
  },
  {
    id: "OC-2026-0040",
    proveedorId: "prov-7",
    fecha: "2026-09-13",
    fechaEstimada: "2026-09-18",
    estado: "recibida",
    operario: "Lucía Romero",
    lineas: [
      { sku: "BEB-CER-073", cantidad: 96, precioUnitario: 1750 },
      { sku: "BEB-GAS-072", cantidad: 60, precioUnitario: 1240 },
    ],
  },
  {
    id: "OC-2026-0039",
    proveedorId: "prov-8",
    fecha: "2026-09-11",
    fechaEstimada: "2026-09-16",
    estado: "recibida",
    operario: "Mariano Vega",
    lineas: [
      { sku: "LAC-LECH-080", cantidad: 60, precioUnitario: 1880 },
      { sku: "LAC-YOG-081",  cantidad: 40, precioUnitario: 2350 },
      { sku: "LAC-QUE-082",  cantidad: 24, precioUnitario: 3480 },
    ],
  },
  {
    id: "OC-2026-0038",
    proveedorId: "prov-4",
    fecha: "2026-09-08",
    fechaEstimada: "2026-09-13",
    estado: "recibida",
    operario: "Lucía Romero",
    lineas: [
      { sku: "CON-TOM-040", cantidad: 144, precioUnitario: 1520 },
      { sku: "CON-ATU-041", cantidad: 72,  precioUnitario: 2820 },
    ],
  },
];
