import { useMemo } from "react";

// ---------------------------------------------------------------------------
// MovementsMiniChart — gráfico de barras compacto para el dashboard.
// Muestra entradas y salidas diarias en los últimos N días.
// ---------------------------------------------------------------------------

interface DayBucket {
  fecha: string;
  entradas: number;
  salidas: number;
}

interface Props {
  data: DayBucket[];
  height?: number;
  /** Etiqueta a mostrar en el eje Y (e.g. "unidades"). */
  unitLabel?: string;
}

const PAD_X = 24;
const PAD_Y = 18;

export default function MovementsMiniChart({
  data,
  height = 140,
  unitLabel = "un",
}: Props) {
  const width = 480;
  const innerW = width - PAD_X * 2;
  const innerH = height - PAD_Y * 2;

  const maxVal = useMemo(
    () => Math.max(1, ...data.flatMap((d) => [d.entradas, d.salidas])),
    [data],
  );
  const barWidth = data.length > 0 ? innerW / data.length : 0;
  const barGap = Math.max(1, Math.floor(barWidth * 0.18));
  const innerBar = Math.max(2, Math.floor((barWidth - barGap * 2) / 2));

return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-labelledby="mini-chart-title mini-chart-desc"
        className="block"
      >
        <title id="mini-chart-title">{`Movimientos diarios · últimos ${data.length} días`}</title>
        <desc id="mini-chart-desc">
          {`Gráfico de barras con ${data.length} días. Entradas (verde) y salidas (rojo) por día. `}
          {data.length > 0
            ? `Total entradas: ${data.reduce((a, d) => a + d.entradas, 0)}. Total salidas: ${data.reduce((a, d) => a + d.salidas, 0)}.`
            : "Sin datos."}
        </desc>
        {/* Grid horizontal */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = PAD_Y + innerH * t;
          return (
            <line
              key={t}
              x1={PAD_X}
              x2={width - PAD_X}
              y1={y}
              y2={y}
              stroke="var(--color-line)"
              strokeWidth={1}
              strokeDasharray={t === 1 ? "0" : "2 3"}
            />
          );
        })}
        {/* Etiqueta Y superior */}
        <text
          x={PAD_X}
          y={PAD_Y - 4}
          className="mono"
          fontSize="9"
          fill="var(--color-ink-500)"
          aria-hidden="true"
        >
          {Math.round(maxVal).toLocaleString("es-AR")} {unitLabel}
        </text>

        {data.map((d, i) => {
          const x = PAD_X + barWidth * i + barGap;
          const hE = (d.entradas / maxVal) * innerH;
          const hS = (d.salidas / maxVal) * innerH;
          return (
            <g key={d.fecha}>
              <rect
                x={x}
                y={PAD_Y + innerH - hE}
                width={innerBar}
                height={Math.max(0.5, hE)}
                fill="var(--color-status-ok)"
                opacity={0.85}
                rx={1}
              />
              <rect
                x={x + innerBar + 1}
                y={PAD_Y + innerH - hS}
                width={innerBar}
                height={Math.max(0.5, hS)}
                fill="var(--color-status-bad)"
                opacity={0.7}
                rx={1}
              />
            </g>
          );
        })}
        {/* Etiqueta X (inicio/medio/fin) */}
        {data.length > 0 ? (
          <>
            <text
              x={PAD_X}
              y={height - 4}
              className="mono"
              fontSize="9"
              fill="var(--color-ink-500)"
              aria-hidden="true"
            >
              {data[0].fecha.slice(5)}
            </text>
            <text
              x={width - PAD_X}
              y={height - 4}
              textAnchor="end"
              className="mono"
              fontSize="9"
              fill="var(--color-ink-500)"
              aria-hidden="true"
            >
              {data[data.length - 1].fecha.slice(5)}
            </text>
          </>
        ) : null}
      </svg>
<div className="mt-1 flex items-center gap-4 text-[11px] text-[var(--color-ink-500)]">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-[2px] bg-[var(--color-status-ok)]"
          />
          Entradas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-[2px] bg-[var(--color-status-bad)] opacity-70"
          />
          Salidas
        </span>
      </div>
      {/* Tabla fallback para lectores de pantalla */}
      <table className="sr-only">
        <caption>Movimientos diarios — últimos {data.length} días</caption>
        <thead>
          <tr><th scope="col">Fecha</th><th scope="col">Entradas</th><th scope="col">Salidas</th></tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.fecha}>
              <td>{d.fecha}</td>
              <td>{d.entradas}</td>
              <td>{d.salidas}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
