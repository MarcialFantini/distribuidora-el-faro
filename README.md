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

**Cliente ficticio**: Distribuidora El Faro (zona sur GBA, rubro bebidas y snacks; en el código figura como *Distribuidora del Sur* por consistencia con el resto de la cartera).

---

## Solución

Una SPA-lite construida sobre **Astro 7 + React 19 + Tailwind v4**, con tres rutas estáticas:

| Ruta | Qué hace |
|---|---|
| `/` | Panel principal: KPIs, filtros (categoría / estado / búsqueda) y tabla de productos con acciones inline (`+` / `−` en stock, edición, eliminar). |
| `/producto/nuevo` | Formulario de alta con validación completa y sugerencia automática de SKU. |
| `/producto/editar` | Mismo formulario, modo edición. Carga el producto desde `localStorage` leyendo `?sku=` de la URL. |

Todo el estado vive en `localStorage` bajo la clave `delsur.inventario.v1`, con un esquema versionado (`{ version, products[] }`) para futuras migraciones. Hay un botón **"Restablecer"** que vuelve al catálogo seed.

### Modelo de alertas (configurable)

El estado de cada producto se deriva en `src/lib/inventory.ts`, función `statusOf(product)`:

| Estado | Condición | Color |
|---|---|---|
| `ok` | `stockMinimo === 0` o `stockActual > stockMinimo` | Verde (`--color-status-ok`) |
| `bajo` | `stockActual ≤ stockMinimo` | Ámbar (`--color-status-warn`) |
| `critico` | `stockActual ≤ ⌊stockMinimo / 2⌋` | Rojo (`--color-status-bad`) |

Los colores son **CSS variables en `src/styles/global.css`** dentro del bloque `@theme` — se pueden ajustar sin tocar componentes. El umbral es **por producto** (campo `stockMinimo`), así que cada SKU define cuándo le suena la alarma.

### Criterios de aceptación cumplidos

- [x] **T03.1** La tabla del dashboard muestra SKU, nombre, categoría, stock actual, stock mínimo, **precio**, estado visual y acciones.
- [x] **T03.2** La alerta de bajo stock se dispara cuando `stockActual ≤ stockMinimo`, con color configurable vía CSS variables (umbrales documentados en `inventory.ts`).
- [x] **T03.3** El alta valida nombre (≥3 chars), SKU único (regex `[A-Z0-9-]{3,20}` + colisión contra catálogo), categoría, stock, precio y stock mínimo.
- [x] **T03.4** La edición carga los datos existentes desde `localStorage` leyendo `?sku=` y guarda con la misma validación.
- [x] **T03.5** Toda mutación persiste inmediatamente vía `writeState()` y sobrevive a refresh.
- [x] **T03.6** Accesibilidad: `<label htmlFor>` real, `aria-invalid` en cada input, `:focus-visible` con outline 2 px, skip-link al main, `role="alert"` en errores, `aria-live="polite"` en toasts.
- [x] **T03.7** `pnpm build` y `pnpm astro check` en 0 errores.
- [x] **T03.8** Este README sigue la estructura Problema / Solución / Stack / Cómo correrlo / Disclaimer.
- [x] **T03.9** El proyecto es **completamente estático** (output por defecto). Las rutas `/producto/nuevo` y `/producto/editar` no son dinámicas — son archivos estáticos; la edición lee `?sku=` en el cliente. **No hace falta adapter SSR**; `astro.config.mjs` no declara `output: 'server'/'hybrid'` ni `@astrojs/node`. Ver *Decisiones técnicas*.

---

## Stack

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | Astro | 7.3.x |
| UI islands | React | 19.3.x |
| Estilos | Tailwind CSS v4 vía `@tailwindcss/vite` (sin `tailwind.config.js`) | 4.3.x |
| Iconos | `@phosphor-icons/react` | 2.1.x |
| Tipografías | `@fontsource-variable/geist` + `geist-mono` | 5.3.x |
| Lenguaje | TypeScript estricto (`astro/tsconfigs/strict`) | 5.9.x |
| Package manager | pnpm (exclusivo, lockfile versionado) | 11.x |
| Persistencia | `window.localStorage` (sin backend) | — |

**Salida**: sitio estático. Tres páginas se prerendizan a HTML en `pnpm build` (`dist/index.html`, `dist/producto/nuevo/index.html`, `dist/producto/editar/index.html`). El JS de las islas se bundle por separado en `dist/_astro/`.

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

Al abrir la app por primera vez, el catálogo seed (18 productos demo de la categoría almacén: arroz, fideos, aceite, legumbres, conservas, condimentos) se escribe automáticamente en `localStorage`. Para volver al estado inicial en cualquier momento: botón **"Restablecer"** en el panel principal.

Para empezar de cero en el navegador: DevTools → Storage → Clear site data, o `localStorage.clear()` en la consola.

### Estructura del proyecto

```text
src/
├── components/
│   ├── Dashboard.tsx       # Isla principal: KPIs + filtros + tabla
│   ├── Header.astro         # Shell estático con SearchBox + ThemeToggle
│   ├── ProductForm.tsx      # Isla compartida por alta y edición
│   ├── SearchBox.tsx        # Isla de búsqueda (⌘K)
│   └── ThemeToggle.tsx      # Isla light/dark
├── data/
│   └── seed.ts              # Catálogo inicial + tipos (Product, Category, StockStatus)
├── layouts/
│   └── Layout.astro         # HTML shell, theme bootstrap inline, skip link
├── lib/
│   ├── inventory.ts         # statusOf(), deriveKpis(), formatters, SKU suggester
│   └── storage.ts           # CRUD sobre localStorage (read/write/upsert/delete)
├── pages/
│   ├── index.astro          # / — Panel principal
│   └── producto/
│       ├── nuevo.astro      # /producto/nuevo
│       └── editar.astro     # /producto/editar?sku=XXX
└── styles/
    └── global.css           # @theme tokens + dark mode override
```

---

## Decisiones técnicas

- **Static over SSR.** Astro 7 sale en modo `static` por defecto. Las rutas `producto/nuevo` y `producto/editar` **no son dinámicas** (`[sku].astro`) — son archivos estáticos, y la página de edición lee `?sku=` en el cliente. Esto evita el adapter SSR y mantiene `dist/` 100% HTML estático servible desde cualquier CDN. El brief inicial sugería `output: 'server'/'hybrid'`, pero ese approach habría sido innecesario: la fuente de verdad es `localStorage` y no se puede renderizar por SKU en build time.
- **Una sola isla para alta + edición.** `ProductForm` recibe `mode="create" | "edit"` y resuelve el SKU desde prop o desde `?sku=`. Reduce duplicación y mantiene idéntica la UX entre ambos flujos.
- **`client:only="react"` en la edición.** Como la página es estática y el SKU se conoce recién en el cliente, usamos `client:only` para evitar el flash de un form vacío. La página nueva usa `client:load` (el form sí se puede mostrar de entrada con el estado vacío inicial).
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