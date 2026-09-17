import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// SearchBox
//
// On submit or `change` of the input, this navigates to "/?q=<term>" so the
// dashboard island can pick the query up from the URL. We deliberately keep
// the island tiny — the table is the source of truth for filtering.
// ---------------------------------------------------------------------------

export default function SearchBox() {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) setValue(q);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = value.trim();
    const url = new URL(window.location.href);
    if (term) url.searchParams.set("q", term);
    else url.searchParams.delete("q");
    window.location.href = url.pathname + (url.search || "");
  }

  return (
    <form
      onSubmit={submit}
      role="search"
      className={`relative flex items-center transition-[width] duration-200 ${
        open ? "w-full sm:w-72" : "w-9 sm:w-64"
      }`}
    >
      <button
        type="button"
        aria-label="Abrir búsqueda"
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-700)] transition-colors hover:bg-[var(--color-surface-muted)] sm:hidden ${
          open ? "hidden" : ""
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </button>

      <div
        className={`relative w-full ${open ? "block" : "hidden sm:block"}`}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-500)]"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </span>
        <input
          ref={inputRef}
          type="search"
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            if (!value) setOpen(false);
          }}
          placeholder="Buscar SKU o nombre"
          aria-label="Buscar producto por SKU o nombre"
          autoComplete="off"
          className="h-9 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] pl-9 pr-12 text-sm text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-500)] focus:border-[var(--color-focus)] focus:outline-none"
        />
        <kbd
          aria-hidden="true"
          className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-[var(--color-line)] bg-[var(--color-surface-muted)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-ink-500)] sm:block"
        >
          ⌘K
        </kbd>
      </div>
    </form>
  );
}
