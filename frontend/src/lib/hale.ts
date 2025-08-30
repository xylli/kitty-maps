import { promises as fs } from "node:fs";
import path from "node:path";
import { csvParse, autoType } from "d3-dsv";

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
      "HALE data file not found. Ensure it exists at public/data/hale.csv or update the path."
    );
  }
}
