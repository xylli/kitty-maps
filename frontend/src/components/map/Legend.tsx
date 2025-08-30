"use client";
import * as d3 from "d3";
import React from "react";

interface LegendProps {
  color: d3.ScaleSequential<string, never>;
  width: number;
  height: number;
}

export default function Legend({ color, width, height }: LegendProps) {
  const legendWidth = Math.min(260, Math.max(120, width * 0.28));
  const legendHeight = 10;
  const legendX = width - legendWidth - 16;
  const legendY = height - legendHeight - 16;
  const [d0, d1] = (color.domain() as [number, number]) ?? [0, 1];
  const ticks = d3.ticks(d0, d1, 4);
  const n = 12;
  const stops = d3.range(n).map((i) => {
    const t = i / (n - 1);
    const v = d0 + t * (d1 - d0);
    return { offset: `${t * 100}%`, color: color(v) };
  });
  const scaleX = d3.scaleLinear([d0, d1], [0, legendWidth]);

  return (
    <g aria-hidden="true">
      <defs>
        <linearGradient id="legend-gradient" x1="0" x2="1" y1="0" y2="0">
          {stops.map((s, i) => (
            <stop key={i} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>
      </defs>
      <rect
        x={legendX}
        y={legendY}
        width={legendWidth}
        height={legendHeight}
        fill="url(#legend-gradient)"
        stroke="#ccc"
        strokeWidth={0.5}
        rx={2}
      />
      <g
        transform={`translate(${legendX}, ${legendY + legendHeight + 4})`}
        fill="#374151"
        fontSize={10}
      >
        {ticks.map((t, i) => (
          <g key={i} transform={`translate(${scaleX(t)}, 0)`}>
            <line y1={0} y2={4} stroke="#6b7280" />
            <text y={14} textAnchor="middle">
              {d3.format(".2~f")(t)}
            </text>
          </g>
        ))}
        <text x={legendWidth} y={28} textAnchor="end" fill="#6b7280">
          HALE
        </text>
      </g>
    </g>
  );
}
