# AGENTS — Distribuidora El Faro (proyecto 03)

Stack: Astro 7.3 + React 19 + Tailwind 4 + TS estricto.
Output: static (sin adapter).
Persistencia: localStorage con schema versionado (v3 actual, migración v2→v3 automática).
Cliente ficticio: Distribuidora El Faro (zona sur GBA).
Mock data: src/data/seed.ts (32 SKUs, 8 proveedores, 4 operarios).
Single source of truth: src/data/seed.ts (catálogo inicial), src/lib/storage.ts (estado runtime).
No SSR. No backend. Demo destruible.