import { useMemo } from "react";

// ---------------------------------------------------------------------------
// StockChart — gráfico de línea SVG para la evolución del stock de un
// producto. Muestra entradas y salidas en columnas gemelas + una línea
// con el stock teórico al cierre de cada mes.
// ---------------------------------------------------------------------------

interface MonthBucket {
  mes: string;
  stockTeorico: number;
  entradas: number;
  salidas: number;
}

interface Props {
  data: MonthBucket[];
  unitLabel?: string;
  height?: number;
}

const PAD_X = 32;
const PAD_Y = 26;

export default function StockChart({ data, unitLabel = "un", height = 200 }: Props) {
  const width = 560;
  const innerW = width - PAD_X * 2;
  const innerH = height - PAD_Y * 2;

  const maxStock = useMemo(
    () => Math.max(1, ...data.map((d) => Math.max(d.stockTeorico, d.entradas + d.salidas))),
    [data],
  );

  const stepX = data.length > 1 ? innerW / (data.length - 1) : innerW;

  const linePath = useMemo(() => {
    if (data.length === 0) return "";
    return data
      .map((d, i) => {
        const x = PAD_X + stepX * i;
        const y = PAD_Y + innerH - (d.stockTeorico / maxStock) * innerH;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [data, maxStock, innerH, stepX]);

  const yTicks = [0, 0.25, 0.5, 0.75, 1];

return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-labelledby="stock-chart-title stock-chart-desc"
        className="block"
      >
        <title id="stock-chart-title">Evolución del stock por mes</title>
        <desc id="stock-chart-desc">
          {data.length === 0
            ? "Sin datos para mostrar."
            : `Gráfico de línea con ${data.length} meses. Stock teórico al cierre de cada mes, en ${unitLabel}. Rango: ${data[0].mes} → ${data[data.length - 1].mes}.`}
        </desc>
        {yTicks.map((t) => {
          const y = PAD_Y + innerH * (1 - t);
          return (
            <g key={t}>
              <line
                x1={PAD_X}
                x2={width - PAD_X}
                y1={y}
                y2={y}
                stroke="var(--color-line)"
                strokeDasharray={t === 0 ? "0" : "2 3"}
              />
              <text
                x={PAD_X - 6}
                y={y + 3}
                textAnchor="end"
                fontSize="9"
                className="mono"
                fill="var(--color-ink-500)"
              >
                {Math.round(maxStock * t).toLocaleString("es-AR")}
              </text>
            </g>
          );
        })}
        {data.length > 0 ? (
          <>
            <path
              d={linePath}
              stroke="var(--color-ocean)"
              strokeWidth="2"
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {data.map((d, i) => {
              const x = PAD_X + stepX * i;
              const y =
                PAD_Y + innerH - (d.stockTeorico / maxStock) * innerH;
              return (
                <g key={d.mes}>
                  <circle cx={x} cy={y} r={2.5} fill="var(--color-ocean)" />
                  <text
                    x={x}
                    y={height - 6}
                    textAnchor="middle"
                    fontSize="9"
                    className="mono"
                    fill="var(--color-ink-500)"
                  >
                    {d.mes.slice(5)}
                  </text>
                </g>
              );
            })}
          </>
        ) : null}
      </svg>
<div className="mt-1 flex items-center gap-4 text-[11px] text-[var(--color-ink-500)]">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-3 rounded-[2px] bg-[var(--color-ocean)]"
          />
          Stock al cierre del mes ({unitLabel})
        </span>
      </div>
      {/* Tabla fallback para lectores de pantalla */}
      <table className="sr-only">
        <caption>Evolución del stock por mes ({unitLabel})</caption>
        <thead>
          <tr><th scope="col">Mes</th><th scope="col">Stock al cierre</th><th scope="col">Entradas</th><th scope="col">Salidas</th></tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.mes}>
              <td>{d.mes}</td>
              <td>{d.stockTeorico}</td>
              <td>{d.entradas}</td>
              <td>{d.salidas}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
