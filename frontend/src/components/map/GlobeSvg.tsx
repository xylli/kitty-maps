"use client";
import React from "react";

interface GlobeSvgProps {
  width: number;
  height: number;
  svgRef: React.RefObject<SVGSVGElement | null>;
  children: React.ReactNode;
  ariaLabel?: string;
}

export default function GlobeSvg({ width, height, svgRef, children, ariaLabel = "World choropleth globe" }: GlobeSvgProps) {
  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ maxWidth: "100%", height: "auto" }}
      aria-label={ariaLabel}
      role="img"
    >
      {children}
    </svg>
  );
}
