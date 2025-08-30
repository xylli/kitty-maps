import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
    outputFileTracingRoot: __dirname,
    output: "export",
    images: {
        unoptimized: true, // safe for static export + GitHub Pages
    },
    basePath: "",

};

export default nextConfig;
