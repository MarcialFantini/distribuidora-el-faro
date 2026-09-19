# 03 · Inventario — Distribuidora El Faro

Mini sistema de gestión de stock para una distribuidora de bebidas y snacks del sur del GBA. Pensado como panel interno de una sola persona: alta, edición, ajuste rápido de stock y alertas visuales por debajo del umbral mínimo.

> ⚠️ **Demo sin backend.** Toda la información vive en `localStorage` del navegador. No hay servidor, no hay base de datos, no hay sincronización entre dispositivos. Es un portfolio frontend, no un producto productivo.

---

## Problema

Una distribuidora chica necesita un panel simple para:

- ver el stock actual por SKU sin abrir una planilla,
- saber **qué productos están por debajo del umbral mínimo** y requieren reposición,
- dar de alta productos nuevos y corregir los existentes sin pelearse con Excel,
- distinguir de un vistazo entre stock normal, bajo y crítico.

Las planillas se desactualizan, los sistemas ERP son carísimos para el volumen de estaPyME, y un sistema "de papel" no permite filtrar ni ordenar. El panel resuelve lo justo: ver, alertar, editar.

**Cliente ficticio**: Distribuidora El Faro (zona sur GBA, rubro bebidas y snacks).

---

## Solución

Una SPA-lite construida sobre **Astro 7 + React 19 + Tailwind v4**, con diez rutas estáticas y un cliente de búsqueda global con atajo `⌘K` / `Ctrl+K`.

### Rutas

| Ruta | Qué hace |
|---|---|
| `/` | Panel principal: KPIs, filtros, alertas, tabla de productos con acciones inline (`+` / `−` / fijar / eliminar / ver historial). |
| `/producto/nuevo` | Formulario de alta con validación completa, sugerencia automática de SKU y categorías dinámicas. |
| `/producto/editar` | Mismo formulario, modo edición. Carga el producto desde `localStorage` leyendo `?sku=` de la URL. |
| `/producto/[id]` | Detalle de producto con historial de movimientos, gráfico de stock y acciones rápidas. |
| `/categorias` | Listado y métricas por categoría (productos, stock total, alertas, valor). |
| `/movimientos` | Bitácora cronológica de movimientos con filtros por producto, operario y tipo. |
| `/reportes` | Tres reportes exportables a PDF (stock crítico, valorización, proyección de rotación). |
| `/proveedores` | Listado de proveedores con métricas, búsqueda y enlace a la orden de compra. |
| `/proveedores/nueva` | Formulario de alta de orden de compra con líneas (SKU + cantidad + precio). |
| `/auditoria` | Log inmutable de operaciones relevantes, filtrable por operario y acción. |

Todo el estado vive en `localStorage` bajo la clave `elfaro.inventario.v3`, con esquema versionado (`{ version, products, proveedores, operarios, ordenes, audit, activeOperarioId }`) y migración automática desde v1 y v2. Hay un botón **"Restablecer"** que vuelve al catálogo seed.

### Modelo de alertas (configurable)

El estado de cada producto se deriva en `src/lib/inventory.ts`, función `statusOf(product)`:

| Estado | Condición | Color |
|---|---|---|
| `ok` | `stockMinimo === 0` o `stockActual > stockMinimo` | Verde (`--color-status-ok`) |
| `bajo` | `stockActual ≤ stockMinimo` (y > 0) | Ámbar (`--color-alert`) |
| `critico` | `stockActual === 0` o `stockActual ≤ ⌊stockMinimo / 2⌋` | Rojo (`--color-status-bad`) |

Adicionalmente, `AlertsBanner` detecta un cuarto tier **`sobrestock`** (`stockActual > stockMinimo × 5`, multiplicador configurable) para señalar productos con exceso de depósito. Los colores son **CSS variables en `src/styles/global.css`** dentro del bloque `@theme` — se pueden ajustar sin tocar componentes. El umbral es **por producto** (campo `stockMinimo`).

### Criterios de aceptación cumplidos

- [x] **T03.1** La tabla del dashboard muestra SKU, nombre, categoría, stock actual, stock mínimo, **precio**, estado visual y acciones.
- [x] **T03.2** Alerta de bajo stock cuando `stockActual ≤ stockMinimo`, con color configurable vía CSS variables (umbrales documentados en `inventory.ts`). Tier adicional `sobrestock` con multiplicador 5×.
- [x] **T03.3** Alta valida nombre (≥3 chars), SKU único (regex `[A-Z0-9-]{3,20}` + colisión contra catálogo), categoría libre (texto o selector), stock, precio y stock mínimo.
- [x] **T03.4** Edición carga datos desde `localStorage` leyendo `?sku=` y guarda con la misma validación.
- [x] **T03.5** Toda mutación persiste inmediatamente vía `writeState()` y sobrevive a refresh.
- [x] **T03.6** Accesibilidad: `<label htmlFor>` real, `aria-invalid` + `aria-describedby` en cada input con error, `:focus-visible` con outline 2 px, skip-link al main, `role="alert"` en errores, `aria-live="polite"` en toasts.
- [x] **T03.7** `pnpm build` y `pnpm astro check` en 0 errores.
- [x] **T03.8** Este README sigue la estructura Problema / Solución / Stack / Cómo correrlo / Decisiones técnicas / Disclaimer.
- [x] **T03.9** El proyecto es **completamente estático** (output por defecto). No hace falta adapter SSR; `astro.config.mjs` no declara `output: 'server'/'hybrid'` ni `@astrojs/node`.

---

## Stack

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | Astro | 7.3.x |
| UI islands | React | 19.3.x |
| Estilos | Tailwind CSS v4 vía `@tailwindcss/vite` (sin `tailwind.config.js`) | 4.3.x |
| Iconos | `@phosphor-icons/react` | 2.1.x |
| Tipografías | IBM Plex Sans + IBM Plex Mono (Bunny Fonts CDN, sin deps npm) | — |
| Lenguaje | TypeScript estricto (`astro/tsconfigs/strict`) | 5.9.x |
| Package manager | pnpm (exclusivo, lockfile versionado) | 11.x |
| Persistencia | `window.localStorage` con esquema versionado (v3) | — |

**Salida**: sitio estático. Diez páginas se prerendizan a HTML en `pnpm build` (`dist/index.html`, `dist/categorias/index.html`, `dist/movimientos/index.html`, `dist/reportes/index.html`, `dist/proveedores/index.html`, `dist/proveedores/nueva/index.html`, `dist/auditoria/index.html`, `dist/producto/nuevo/index.html`, `dist/producto/editar/index.html`, `dist/producto/<sku>/index.html`). El JS de las islas se bundle por separado en `dist/_astro/`.

---

## Cómo correrlo

```sh
# 1. Instalar dependencias (pnpm exclusivo)
pnpm install

# 2. Levantar el dev server en http://127.0.0.1:4301
pnpm dev

# 3. (Opcional) Verificar tipos
pnpm astro check

# 4. Build de producción a ./dist
pnpm build

# 5. Servir el build localmente
pnpm preview
```

### Primer uso

Al abrir la app por primera vez, el catálogo seed (32 SKUs de 10 categorías — arroz, fideos, aceite, legumbres, conservas, condimentos, snacks, bebidas, lácteos, limpieza — más 8 proveedores y 4 operarios) se escribe automáticamente en `localStorage` bajo la clave `elfaro.inventario.v3`. Para volver al estado inicial en cualquier momento: botón **"Restablecer"** en el panel principal.

Para empezar de cero en el navegador: DevTools → Storage → Clear site data, o `localStorage.clear()` en la consola.

### Estructura del proyecto

```text
src/
├── components/
│   ├── Dashboard.tsx           # Isla principal: KPIs + filtros + tabla + acciones
│   ├── Header.astro            # Shell estático con GlobalSearch + ThemeToggle + OperarioSelector
│   ├── ProductForm.tsx         # Isla compartida por alta y edición
│   ├── ProductDetail.tsx       # Detalle de producto + historial + gráfico
│   ├── AlertsBanner.tsx        # Alertas activo / bajo / crítico / sobrestock
│   ├── MovementHistory.tsx     # Drawer de movimientos con form de alta inline
│   ├── MovementsView.tsx       # Bitácora global de movimientos
│   ├── ReportsView.tsx         # Reportes + export PDF (jspdf)
│   ├── SuppliersView.tsx       # Listado de proveedores con métricas
│   ├── NewPurchaseOrder.tsx    # Alta de orden de compra
│   ├── CategoriesView.tsx      # Métricas por categoría
│   ├── AuditView.tsx           # Log de auditoría con iconos + colores
│   ├── MovementsMiniChart.tsx  # Barras entradas/salidas (30 días)
│   ├── StockChart.tsx          # Línea de stock + barras por mes
│   ├── StatusBadge.tsx         # Badge compartido (ok/bajo/crítico) con icono
│   ├── CSVImporter.tsx         # Importador CSV vanilla (RFC 4180 lite)
│   ├── GlobalSearch.tsx        # Paleta ⌘K de búsqueda
│   ├── SearchBox.tsx           # Input de búsqueda del dashboard
│   ├── OperarioSelector.tsx    # Switcher de operario activo
│   ├── OperarioContext.tsx     # Provider de operario activo
│   ├── DataTable.tsx           # Tabla genérica con sort + paginación
│   └── ThemeToggle.tsx         # Switch light/dark
├── data/
│   └── seed.ts                 # Catálogo inicial + tipos (Product, AuditEntry, etc.)
├── layouts/
│   └── Layout.astro            # HTML shell + SEO + theme bootstrap inline + skip-link
├── lib/
│   ├── inventory.ts            # statusOf(), deriveKpis(), formatters, SKU suggester
│   ├── storage.ts              # CRUD sobre localStorage (read/write/upsert/delete + migrate)
│   ├── categories.ts           # SEED_CATEGORIES + deriveCategories()
│   └── pdf.ts                  # Wrappers de jspdf-autotable para reportes PDF
├── pages/
│   ├── index.astro             # /  Panel principal
│   ├── categorias.astro        # /categorias
│   ├── movimientos.astro       # /movimientos
│   ├── reportes.astro          # /reportes
│   ├── proveedores.astro       # /proveedores
│   ├── proveedores/
│   │   └── nueva.astro         # /proveedores/nueva
│   ├── auditoria.astro         # /auditoria
│   └── producto/
│       ├── nuevo.astro         # /producto/nuevo
│       ├── editar.astro        # /producto/editar?sku=XXX
│       └── [id].astro          # /producto/<sku>
└── styles/
    └── global.css              # @theme tokens + dark mode override
```

---

## Decisiones técnicas

- **Static over SSR.** Astro 7 sale en modo `static` por defecto. La ruta `producto/[id]` usa `getStaticPaths()` con todos los SKUs del seed (las altas del usuario solo existen en su `localStorage`); la edición y el detalle leen `?sku=` en el cliente. Esto evita el adapter SSR y mantiene `dist/` 100% HTML estático servible desde cualquier CDN. El brief inicial sugería `output: 'server'/'hybrid'`, pero ese approach habría sido innecesario: la fuente de verdad es `localStorage` y no se puede renderizar por SKU en build time.
- **React islands, no Preact.** React 19 se justifica porque necesitamos `<details>`, `<dialog>` y portales de modal sin tener que pelear con las diferencias de typings Preact. La diferencia de bundle (≈10 KB gzipped) no justifica la fricción para un proyecto de este tamaño, y Astro ya hace tree-shaking agresivo de las islas que no se usan.
- **localStorage con schema versionado.** Cada bump de versión (`v1 → v2 → v3`) corre una `migrate()` que toma el payload anterior y lo adapta al shape actual. La nueva clave `elfaro.inventario.v3` se introdujo al renombrar el cliente (de "Distribuidora del Sur" a "Distribuidora El Faro") — la migración v2→v3 es un no-op de shape, pero el bump permite invalidar automáticamente la sesión del usuario sin necesidad de banner de "actualizá la página".
- **Dual theme.** Light + dark soportados vía CSS variables en `src/styles/global.css`. El bootstrap es **inline en el `<head>`** para evitar el flash de tema claro en clientes dark. La elección del usuario persiste en `localStorage["elfaro.theme"]` y se sincroniza con `prefers-color-scheme` si no hay elección guardada.
- **Audit counter derivado del array.** El ID de cada entrada de auditoría se calcula desde el máximo numérico presente en el array, en lugar de un contador módulo-level. Esto sobrevive al refresh y a múltiples pestañas sin colisiones, y la semilla `1000` preserva compatibilidad con el contador anterior.
- **Categorías dinámicas.** El campo `Product.categoria` es `string` (no un literal union) para permitir que el usuario cree y elimine categorías. El set inicial vive en `src/lib/categories.ts` (`SEED_CATEGORIES`); `deriveCategories()` respeta ese orden y agrega las dinámicas al final en orden alfabético.
- **CSV parser vanilla.** Sin dependencias para CSV — el parser es RFC 4180 lite (≈100 líneas en `CSVImporter.tsx`) y maneja quoted fields, comillas escapadas y saltos de línea embebidos. `.xlsx` se rechaza explícitamente.
- **Una sola isla para alta + edición.** `ProductForm` recibe `mode="create" | "edit"` y resuelve el SKU desde prop o desde `?sku=`. Reduce duplicación y mantiene idéntica la UX entre ambos flujos.
- **`client:only="react"` en la edición y el detalle.** Como la página es estática y el SKU se conoce recién en el cliente, usamos `client:only` para evitar el flash de un form vacío.
- **Umbral por producto, no global.** Cada SKU define su propio `stockMinimo`. Refleja la realidad: una caja de atún necesita 45 para reponer, un kilo de arroz necesita 60. Un umbral global sería una mentira para una distribuidora real.
- **Estado `critico` cuando `stockActual ≤ ⌊stockMinimo / 2⌋`.** Distingue "te queda poco" de "te queda casi nada" sin agregar UI nueva — el mismo badge cambia de color.
- **Persistencia inmediata.** Cada mutación llama `writeState(products)` en un `useEffect`, así no hay botón "guardar" global. El usuario edita y la próxima refresh ya ve el cambio.

---

## Disclaimer

Esto es una **demo frontend sin backend**:

- ❌ No hay servidor: la página estática se sirve desde cualquier hosting (Vercel, Netlify, GitHub Pages, S3).
- ❌ No hay base de datos: el estado vive en `localStorage` de **un solo navegador**. Cambiar de device o limpiar el storage borra todo.
- ❌ No hay autenticación: cualquiera con el link edita el inventario.
- ❌ No hay sincronización: dos pestañas en el mismo navegador se pisan entre sí.
- ❌ El catálogo inicial y los precios son **datos ficticios** para mostrar la UI, no son reales.

Para uso real habría que enchufar una API (REST, tRPC, Supabase, Firebase, lo que sea) y reemplazar `src/lib/storage.ts` por un cliente HTTP. La capa de UI está lista: solo cambia la fuente de datos.

No usar en producción. Es un portfolio, no un SaaS.