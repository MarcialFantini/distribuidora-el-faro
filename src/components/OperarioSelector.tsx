import { useEffect, useRef, useState } from "react";
import { CaretDown, Check, UserCircle } from "@phosphor-icons/react";
import { useOperario } from "./OperarioContext";

// ---------------------------------------------------------------------------
// OperarioSelector — chip + dropdown con el operario activo.
//
// Persiste la elección en localStorage. El provider mantiene el resto de
// los consumidores sincronizados vía contexto.
// ---------------------------------------------------------------------------

export default function OperarioSelector() {
  const { operarios, active, setActiveId } = useOperario();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!active) {
    return (
      <div className="h-9 w-[140px] animate-pulse rounded-md border border-[var(--color-line)] bg-[var(--color-surface)]" />
    );
  }

  const initials = active.nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Cambiar operario activo"
        className="group inline-flex h-9 items-center gap-2 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] pl-1.5 pr-2 text-sm text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)]"
      >
        <span
          aria-hidden="true"
          className="grid h-6 w-6 place-items-center rounded-[3px] font-mono text-[10px] font-semibold uppercase tracking-[0.04em] text-white"
          style={{ backgroundColor: active.color }}
        >
          {initials}
        </span>
        <span className="hidden flex-col items-start leading-tight sm:flex">
          <span className="text-[12px] font-medium text-[var(--color-ink-900)]">
            {active.nombre.split(" ")[0]}
          </span>
          <span className="mono text-[9.5px] uppercase tracking-[0.08em] text-[var(--color-ink-500)]">
            {active.rol}
          </span>
        </span>
        <CaretDown
          size={11}
          weight="bold"
          aria-hidden="true"
          className={`text-[var(--color-ink-500)] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Operarios disponibles"
          className="absolute right-0 z-40 mt-1.5 w-56 overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] shadow-lg shadow-[oklch(0_0_0_/_0.06)]"
        >
          <p className="border-b border-[var(--color-line)] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-ink-500)]">
            Operario activo
          </p>
          <ul className="max-h-72 overflow-auto py-1">
            {operarios.map((o) => {
              const ini = o.nombre
                .split(/\s+/)
                .slice(0, 2)
                .map((w) => w[0])
                .join("")
                .toUpperCase();
              const isActive = o.id === active.id;
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      setActiveId(o.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                      isActive
                        ? "bg-[var(--color-ocean-soft)] text-[var(--color-ink-900)]"
                        : "text-[var(--color-ink-700)] hover:bg-[var(--color-surface-muted)]"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-[3px] font-mono text-[10px] font-semibold uppercase tracking-[0.04em] text-white"
                      style={{ backgroundColor: o.color }}
                    >
                      {ini}
                    </span>
                    <span className="flex-1 truncate">{o.nombre}</span>
                    <span className="mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-ink-500)]">
                      {o.rol}
                    </span>
                    {isActive ? (
                      <Check
                        size={12}
                        weight="bold"
                        aria-hidden="true"
                        className="text-[var(--color-ocean)]"
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-[var(--color-line)] px-3 py-2 text-[11px] text-[var(--color-ink-500)]">
            <UserCircle size={11} weight="bold" className="mr-1 inline align-text-bottom" />
            Las acciones quedan registradas a tu nombre.
          </p>
        </div>
      ) : null}
    </div>
  );
}
