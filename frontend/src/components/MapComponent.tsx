"use client";
import * as d3 from "d3";
import React, { useEffect, useMemo, useState } from "react";
import { feature, mesh } from "topojson-client";

interface DataEntry {
    country: string;
    hale: number;
}

interface Props {
    data: DataEntry[];
    width?: number;
    height?: number;
    marginTop?: number;
    marginRight?: number;
    marginBottom?: number;
    marginLeft?: number;
}

// ... existing code ...
function MapComponent({
                          data,
                          width = 928,
                          height: providedHeight,
                          marginTop = 20,
                          marginRight = 20,
                          marginBottom = 20,
                          marginLeft = 20,
                      }: Props) {
    const height = providedHeight ?? Math.round(width / 2 + marginTop);

    // Load the local TopoJSON file (place it under public/countries-50m.json)
    const [topology, setTopology] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch("/data/countries-50m.json")
            .then((r) => {
                if (!r.ok) throw new Error(`Failed to fetch countries-50m.json: ${r.status}`);
                return r.json();
            })
            .then((json) => {
                if (!cancelled) setTopology(json);
            })
            .catch((e: any) => {
                if (!cancelled) setError(e?.message ?? String(e));
            });
        return () => {
            cancelled = true;
        };
    }, []);

    // Prepare value lookup
    const valueByName = useMemo(() => {
        const m = new Map<string, number>();
        for (const d of data) {
            if (d.country != null && Number.isFinite(d.hale)) {
                m.set(String(d.country), Number(d.hale));
            }
        }
        return m;
    }, [data]);

    // Color scale
    const color = useMemo(() => {
        const values = Array.from(valueByName.values());
        const domain =
            values.length > 0 ? (d3.extent(values) as [number, number]) : [0, 1];
        return d3.scaleSequential(domain, d3.interpolateYlGnBu);
    }, [valueByName]);

    // Projection and path
    const { projection, path } = useMemo(() => {
        const proj = d3
            .geoEqualEarth()
            .fitExtent(
                [
                    [marginLeft + 2, marginTop + 2],
                    [width - marginRight - 2, height - marginBottom - 2],
                ],
                { type: "Sphere" } as any
            );
        return { projection: proj, path: d3.geoPath(proj) };
    }, [width, height, marginTop, marginRight, marginBottom, marginLeft]);

    const graticule = useMemo(() => d3.geoGraticule10(), []);

    // Convert TopoJSON to GeoJSON features when loaded
    const countries = useMemo(() => {
        if (!topology) return null;
        const obj = topology.objects?.countries;
        if (!obj) return null;
        return feature(topology, obj) as unknown as GeoJSON.FeatureCollection<
            GeoJSON.Geometry,
            Record<string, any>
        >;
    }, [topology]);

    // Country borders (internal boundaries)
    const borders = useMemo(() => {
        if (!topology) return null;
        try {
            return mesh(topology, topology.objects.countries, (a: any, b: any) => a !== b);
        } catch {
            return null;
        }
    }, [topology]);

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            style={{ maxWidth: "100%", height: "auto" }}
            aria-label="World choropleth map"
            role="img"
        >
            {/* Ocean / sphere */}
            <path
                d={path({ type: "Sphere" } as any) ?? undefined}
                fill="#eef5fb"
                stroke="#bcd1e6"
                strokeWidth={1}
            />

            {/* Graticule */}
            <path
                d={path(graticule) ?? undefined}
                fill="none"
                stroke="#c7d7e5"
                strokeOpacity={0.6}
                strokeWidth={0.5}
            />

            {/* Countries */}
            {error && (
                <text x={16} y={24} fill="crimson">
                    {error}
                </text>
            )}
            {!error &&
                countries?.features?.map((f, i) => {
                    const name =
                        (f.properties?.name as string) ??
                        (f.properties?.NAME as string) ??
                        (f.properties?.admin as string) ??
                        "";
                    const v = valueByName.get(name);
                    const fill =
                        v == null || !Number.isFinite(v) ? "#e5e7eb" : color(v as number);
                    return (
                        <path
                            key={i}
                            d={path(f) ?? undefined}
                            fill={fill}
                            stroke="#ffffff"
                            strokeWidth={0.5}
                            strokeLinejoin="round"
                        >
                            <title>
                                {name || "Unknown"}
                                {v == null || !Number.isFinite(v) ? "" : `: ${v}`}
                            </title>
                        </path>
                    );
                })}

            {/* Borders overlay */}
            {borders && (
                <path
                    d={path(borders) ?? undefined}
                    fill="none"
                    stroke="#9ca3af"
                    strokeOpacity={0.6}
                    strokeWidth={0.5}
                />
            )}

            {/* Legend */}
            {(() => {
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
            })()}
        </svg>
    );
}

export default MapComponent;