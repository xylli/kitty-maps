import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const gitHubPagesPath = "/kitty-maps"
const basePath = isProd ? gitHubPagesPath : "";

const nextConfig: NextConfig = {
  /* config options here */
    outputFileTracingRoot: __dirname,
    output: "export",
    images: {
        unoptimized: true, // safe for static export + GitHub Pages
    },
    basePath: basePath,
    assetPrefix: basePath + "/",

    // Optional: lets you prefix manual/public asset URLs in code
    env: {
        NEXT_PUBLIC_BASE_PATH: basePath,
    },

};

export default nextConfig;
