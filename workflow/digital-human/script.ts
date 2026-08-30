import {readFile} from "node:fs/promises";

const timingPrefix = /^[-*]\s*(?:\d+(?:\.\d+)?\s*[-–]\s*\d+(?:\.\d+)?\s*(?:s|秒)?\s*[:：]?\s*)?/i;

export function extractNarration(markdown: string): string {
  const lines = markdown
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.replace(timingPrefix, "").trim())
    .filter(Boolean);
  const unique = lines.filter((line, index) => index === 0 || line !== lines[index - 1]);
  const text = unique.join("\n");
  if (!text) throw new Error("script.md does not contain speakable narration.");
  return text;
}

export async function readNarrationScript(scriptPath: string): Promise<string> {
  return extractNarration(await readFile(scriptPath, "utf8"));
}
