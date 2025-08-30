import Image from "next/image";
import {basePath} from "@/lib/constants";
import MapComponent from "@/components/MapComponent";
import { promises as fs } from "node:fs";
import path from "node:path";
import { csvParse, autoType } from "d3-dsv";

function normalizeCsvHeader(text: string): string {
    const lines = text.split(/\r?\n/);
    if (lines.length === 0) return text;
    const rawHeader = lines[0].replace(/^\uFEFF/, ""); // strip BOM if present
    const trimmedHeader = rawHeader
        .split(",")
        .map((h) => h.trim())
        .join(",");
    return [trimmedHeader, ...lines.slice(1)].join("\n");
}


async function getHaleData() {
    const filePath = path.join(process.cwd(), "public", "data", "hale.csv");
    try {
        const raw = await fs.readFile(filePath, "utf8");
        const text = normalizeCsvHeader(raw);
        const rows = csvParse(text, autoType);
        return rows
            .filter((d: any) => d.country && d.hale !== "-" && d.hale != null)
            .map((d: any) => ({
                country: String(d.country),
                hale: Number(d.hale),
            }));
    } catch (err: any) {
        console.error(`Failed to read CSV at ${filePath}:`, err?.message ?? err);
        throw new Error("HALE data file not found. Ensure it exists at public/data/hale.csv or update the path.");
    }
}


export default async function Home() {
    const hale = await getHaleData();

    return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <MapComponent data={hale}/>

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <a
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 w-full sm:w-auto md:w-[158px]"
            href="https://observablehq.com/@d3/gallery@1113#maps"
            target="_blank"
            rel="noopener noreferrer"
          >
            Gallery
          </a>
        </div>
      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src={`${basePath}/file.svg`}
            alt="File icon"
            width={16}
            height={16}
          />
          Learn
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src={`${basePath}/window.svg`}
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src={`${basePath}/globe.svg`}
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}
