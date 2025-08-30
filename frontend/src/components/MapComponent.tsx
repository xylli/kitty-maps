"use client";
import * as d3 from "d3";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { feature, mesh } from "topojson-client";
import GlobeSvg from "./map/GlobeSvg";
import Legend from "./map/Legend";
import {basePath} from "@/lib/constants";

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

    // Interactivity refs/state for globe
    const svgRef = useRef<SVGSVGElement | null>(null);
    const [rotation, setRotation] = useState<[number, number, number]>([0, 0, 0]); // [lambda, phi, gamma]
    const [scaleK, setScaleK] = useState<number>(1); // zoom scale multiplier
    const rotationRef = useRef(rotation);
    const scaleRef = useRef(scaleK);
    rotationRef.current = rotation;
    scaleRef.current = scaleK;

    // Load the local TopoJSON file (place it under public/countries-50m.json)
    const [topology, setTopology] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch(basePath + "/data/countries-50m.json")
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

    // Projection and path: switch to orthographic globe
    const { projection, path, radius } = useMemo(() => {
        const r = Math.min(width - marginLeft - marginRight, height - marginTop - marginBottom) / 2;
        const baseScale = r; // d3.geoOrthographic scale corresponds to radius
        const proj = d3
            .geoOrthographic()
            .translate([width / 2, height / 2])
            .clipAngle(90)
            .precision(0.5);
        // Apply current rotation and zoom scale
        proj.rotate(rotation as [number, number, number]).scale(baseScale * scaleK);
        return { projection: proj, path: d3.geoPath(proj), radius: r };
    }, [width, height, marginTop, marginRight, marginBottom, marginLeft, rotation, scaleK]);

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

    // Country borders (internal boundaries) - still useful on globe
    const borders = useMemo(() => {
        if (!topology) return null;
        try {
            return mesh(topology, topology.objects.countries, (a: any, b: any) => a !== b);
        } catch {
            return null;
        }
    }, [topology]);

    // Drag to rotate; wheel/pinch to zoom
    useEffect(() => {
        const svg = d3.select(svgRef.current);
        if (svg.empty()) return;

        // Ensure touch gestures reach D3 (prevent browser panning/zooming)
        if (svgRef.current) {
            svgRef.current.style.touchAction = "none";
        }

        // Zoom: adjust scaleK (kept separate from d3 zoom translate)
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.5, 4])
            .filter((event) => {
                // Only wheel or pinch triggers zoom; drag handled by custom drag
                if (event.type === "wheel") return true;
                if (event.type === "touchstart") return (event as any).touches?.length > 1;
                return false;
            })
            .on("zoom", (event) => {
                const k = event.transform.k;
                setScaleK(k);
            });

        svg.call(zoom as any);

        // Drag: rotate the globe (use closure variables instead of stashing on the event)
        let startRotation: [number, number, number] | null = null;
        let startPos: [number, number] | null = null;

        const drag = d3.drag<SVGSVGElement, unknown>()
            .on("start", (event) => {
                startRotation = rotationRef.current.slice() as [number, number, number];
                startPos = [event.x, event.y];
            })
            .on("drag", (event) => {
                // Initialize if for some reason start didn't fire
                if (!startRotation || !startPos) {
                    startRotation = rotationRef.current.slice() as [number, number, number];
                    startPos = [event.x, event.y];
                }

                const [x0, y0] = startPos;
                const dx = event.x - x0;
                const dy = event.y - y0;

                // Sensitivity: 1 pixel ~ 0.25 degrees (tweakable)
                const sens = 0.25;
                const [lambda0, phi0, gamma] = startRotation;

                // update rotation (lambda increases leftwards; invert dx for natural feel)
                const lambda = lambda0 + (-dx * sens);
                const phi = Math.max(-90, Math.min(90, phi0 + (dy * sens))); // clamp latitude tilt
                setRotation([lambda, phi, gamma]);
            });

        svg
            .style("cursor", "grab")
            .on("mousedown.drag-cursor", () => svg.style("cursor", "grabbing"))
            .on("mouseup.drag-cursor", () => svg.style("cursor", "grab"))
            .call(drag as any);

        return () => {
            svg.on(".zoom", null)
                .on(".drag", null)
                .on("mousedown.drag-cursor", null)
                .on("mouseup.drag-cursor", null);
        };
    }, []);


    return (
        <GlobeSvg svgRef={svgRef} width={width} height={height}>
            <defs>
                {/* Clip everything to the sphere */}
                <clipPath id="sphere-clip">
                    <path d={path({ type: "Sphere" } as any) ?? undefined} />
                </clipPath>
                {/* Subtle ocean radial gradient for depth */}
                <radialGradient id="ocean-grad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#eaf3fb" />
                    <stop offset="100%" stopColor="#dceaf7" />
                </radialGradient>
            </defs>

            {/* Ocean / sphere */}
            <path
                d={path({ type: "Sphere" } as any) ?? undefined}
                fill="url(#ocean-grad)"
                stroke="#7da7cd"
                strokeWidth={1}
            />

            {/* Graticule */}
            <path
                d={path(graticule) ?? undefined}
                fill="none"
                stroke="#a9bfd3"
                strokeOpacity={0.6}
                strokeWidth={0.5}
                clipPath="url(#sphere-clip)"
            />

            {/* Countries, clipped to sphere */}
            {error && (
                <text x={16} y={24} fill="crimson">
                    {error}
                </text>
            )}
            {!error && (
                <g clipPath="url(#sphere-clip)">
                    {countries?.features?.map((f, i) => {
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
                                strokeWidth={0.4}
                                strokeLinejoin="round"
                            >
                                <title>
                                    {name || "Unknown"}
                                    {v == null || !Number.isFinite(v) ? "" : `: ${v}`}
                                </title>
                            </path>
                        );
                    })}
                </g>
            )}

            {/* Borders overlay, clipped */}
            {borders && (
                <path
                    d={path(borders) ?? undefined}
                    fill="none"
                    stroke="#9ca3af"
                    strokeOpacity={0.6}
                    strokeWidth={0.5}
                    clipPath="url(#sphere-clip)"
                />
            )}

            {/* Legend */}
            <Legend color={color} width={width} height={height} />
        </GlobeSvg>
    );
}

export default MapComponent;