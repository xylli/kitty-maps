import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const gitHubPagesPath = "/kitty-maps"

const nextConfig: NextConfig = {
  /* config options here */
    outputFileTracingRoot: __dirname,
    output: "export",
    images: {
        unoptimized: true, // safe for static export + GitHub Pages
    },
    basePath: isProd ? gitHubPagesPath : "",
    assetPrefix: isProd ? gitHubPagesPath : "",
    reactStrictMode: true,
};

export default nextConfig;
