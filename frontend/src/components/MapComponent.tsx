"use client";
import * as d3 from "d3";
import React, {useEffect, useMemo, useRef, useState} from "react";
import {feature, mesh} from "topojson-client";
import GlobeSvg from "./map/GlobeSvg";
import Legend from "./map/Legend";

interface DataEntry {
    country: string;
    hale: number;
}

export type TopologyData = any;

interface Props {
    data: DataEntry[];
    width?: number;
    height?: number;
    marginTop?: number;
    marginRight?: number;
    marginBottom?: number;
    marginLeft?: number;
    topology: TopologyData;
}

function MapComponent({
                          data,
                          width = 1468,
                          height: providedHeight,
                          marginTop = 0,
                          marginRight = 20,
                          marginBottom = 0,
                          marginLeft = 20,
                          topology,
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

    // Animation frame refs to throttle heavy updates during interactions
    const rotateRafRef = useRef<number | null>(null);
    const zoomRafRef = useRef<number | null>(null);

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
    const {path} = useMemo(() => {
        const r = Math.min(width - marginLeft - marginRight, height - marginTop - marginBottom) / 2;
        const baseScale = r; // d3.geoOrthographic scale corresponds to radius
        const proj = d3
            .geoOrthographic()
            .translate([width / 2, height / 2])
            .clipAngle(90)
            .precision(0.5);
        // Apply current rotation and zoom scale
        proj.rotate(rotation as [number, number, number]).scale(baseScale * scaleK);
        return {projection: proj, path: d3.geoPath(proj), radius: r};
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

    const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

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
                // Ignore tiny changes to reduce needless re-renders
                if (Math.abs(k - scaleRef.current) < 0.01) return;
                if (zoomRafRef.current != null) cancelAnimationFrame(zoomRafRef.current);
                zoomRafRef.current = requestAnimationFrame(() => {
                    setScaleK(k);
                    zoomRafRef.current = null;
                });
            });

        svg.call(zoom as any);
        zoomBehaviorRef.current = zoom as any;

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

                // Natural-feel mapping: dragging right rotates globe eastward (increase lambda), dragging up tilts north (decrease phi)
                const lambda = lambda0 + (dx * sens);
                const phi = Math.max(-90, Math.min(90, phi0 - (dy * sens))); // clamp latitude tilt

                if (rotateRafRef.current != null) cancelAnimationFrame(rotateRafRef.current);
                const nextRot: [number, number, number] = [lambda, phi, gamma];
                rotateRafRef.current = requestAnimationFrame(() => {
                    setRotation(nextRot);
                    rotateRafRef.current = null;
                });
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
            if (rotateRafRef.current != null) cancelAnimationFrame(rotateRafRef.current);
            if (zoomRafRef.current != null) cancelAnimationFrame(zoomRafRef.current);
        };
    }, []);

    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    const ZOOM_MIN = 0.5;
    const ZOOM_MAX = 4;

    const applyZoom = (nextK: number, animate = true) => {
        const k = clamp(nextK, ZOOM_MIN, ZOOM_MAX);
        setScaleK(k);
        const svgEl = svgRef.current;
        const zb = zoomBehaviorRef.current;
        if (svgEl && zb) {
            const sel = d3.select(svgEl);
            if (animate) {
                sel.transition().duration(200).call((zb as any).scaleTo, k);
            } else {
                sel.call((zb as any).scaleTo, k);
            }
        }
    };

    return (
        <div style={{ position: "relative", width: "100%", maxWidth: width }}>
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
                <g clipPath="url(#sphere-clip)">
                    {countries?.features?.map((f, i) => {
                        let name =
                            (f.properties?.name as string) ??
                            (f.properties?.NAME as string) ??
                            (f.properties?.admin as string) ??
                            "";
                        name = Array.isArray(name) ? name.join(", ") : name;
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
                                <title>{v == null || !Number.isFinite(v) ? (name || "Unknown") : `${name || "Unknown"}: ${v}`}</title>
                            </path>
                        );
                    })}
                </g>

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

            {/* Zoom controls */}
            <div
                style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    zIndex: 1,
                    userSelect: "none",
                }}
                aria-label="Zoom controls"
            >
                <button
                    type="button"
                    onClick={() => applyZoom(scaleK * 1.2)}
                    aria-label="Zoom in"
                    title="Zoom in"
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        border: "1px solid #c7c7c7",
                        background: "#ffffff",
                        color: "#111827",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                        cursor: "pointer",
                        fontSize: 18,
                        lineHeight: "30px",
                        textAlign: "center",
                    }}
                >
                    +
                </button>
                <button
                    type="button"
                    onClick={() => applyZoom(scaleK / 1.2)}
                    aria-label="Zoom out"
                    title="Zoom out"
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        border: "1px solid #c7c7c7",
                        background: "#ffffff",
                        color: "#111827",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                        cursor: "pointer",
                        fontSize: 18,
                        lineHeight: "30px",
                        textAlign: "center",
                    }}
                >
                    −
                </button>
            </div>
        </div>
    );
}

export default MapComponent;