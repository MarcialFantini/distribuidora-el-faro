// ---------------------------------------------------------------------------
// Categorías — fuente canónica de las categorías del catálogo.
//
// Hasta v2 era un `type` con unión literal hardcodeada. A partir de v2.1 las
// categorías son strings libres: el usuario puede crear y eliminar
// categorías desde el módulo de Categorías. Esta lista expone los valores
// iniciales que se siembran con el catálogo y expone una constante para
// componentes que quieran un orden visual estable (selectores, etc.).
// ---------------------------------------------------------------------------

import type { Product } from "../data/seed";

/** Categorías iniciales que vienen con el seed. */
export const SEED_CATEGORIES: readonly string[] = [
  "Arroz",
  "Fideos",
  "Aceite",
  "Legumbres",
  "Conservas",
  "Condimentos",
  "Snacks",
  "Bebidas",
  "Lácteos",
  "Limpieza",
] as const;

/**
 * Devuelve la lista de categorías presentes en un set de productos,
 * respetando el orden del seed primero y luego agregando las dinámicas al
 * final en orden alfabético.
 */
export function deriveCategories(products: readonly Product[]): string[] {
  const present = new Set<string>();
  for (const p of products) present.add(p.categoria);
  const ordered: string[] = [];
  for (const c of SEED_CATEGORIES) {
    if (present.has(c)) {
      ordered.push(c);
      present.delete(c);
    }
  }
  for (const c of Array.from(present).sort((a, b) => a.localeCompare(b, "es"))) {
    ordered.push(c);
  }
  return ordered;
}
