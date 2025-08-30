import { promises as fs } from "node:fs";
import path from "node:path";
import { csvParse, autoType } from "d3-dsv";
import {TopologyData} from "@/components/MapComponent";

export interface HaleRow { country: string; hale: number }

function normalizeCsvHeader(text: string): string {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) return text;
  const rawHeader = lines[0].replace(/^\uFEFF/, "");
  const trimmedHeader = rawHeader
    .split(",")
    .map((h) => h.trim())
    .join(",");
  return [trimmedHeader, ...lines.slice(1)].join("\n");
}

export async function getHaleData(): Promise<HaleRow[]> {
  const filePath = path.join(process.cwd(), "public", "data", "hale.csv");
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const text = normalizeCsvHeader(raw);
    const rows = csvParse(text, autoType) as any[];
    return rows
      .filter((d: any) => d.country && d.hale !== "-" && d.hale != null)
      .map((d: any) => ({ country: String(d.country), hale: Number(d.hale) }));
  } catch (err: any) {
    console.error(`Failed to read CSV at ${filePath}:`, err?.message ?? err);
    throw new Error(
      "HALE data file not found. Ensure it exists or update the path."
    );
  }
}

export async function getTopologyData(): Promise<TopologyData> {
  const filePath = path.join(process.cwd(), "public", "data", "countries-50m.json");
  try {
      try {
          const buf = await fs.readFile(filePath, "utf-8");
          return JSON.parse(buf);
      } catch (e) {
          console.error("Failed to load countries-50m.json on server:", e);
      }
  } catch (err: any) {
    console.error(`Failed to read json at ${filePath}:`, err?.message ?? err);
    throw new Error(
      "Topology data file not found. Ensure it exists or update the path."
    );
  }
}
