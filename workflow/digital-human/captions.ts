import type {CaptionCue} from "./types.js";

function splitPhrases(text: string): string[] {
  return text
    .split(/(?<=[。！？!?；;\n])|(?<=[，,])(?=.{6,})/u)
    .map((value) => value.trim())
    .filter(Boolean)
    .flatMap((value) => value.length <= 22 ? [value] : value.match(/.{1,18}/gu) ?? [value]);
}

export function createCaptionTrack(text: string, durationSeconds: number): CaptionCue[] {
  if (!text.trim()) throw new Error("Caption source text is empty.");
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new Error("Caption duration must be positive.");
  const phrases = splitPhrases(text);
  const weights = phrases.map((phrase) => Math.max(phrase.replace(/\s/gu, "").length, 1));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = 0;
  return phrases.map((phrase, index) => {
    const isLast = index === phrases.length - 1;
    const allocation = durationSeconds * (weights[index]! / totalWeight);
    const startSeconds = cursor;
    const endSeconds = isLast ? durationSeconds : Math.min(durationSeconds, cursor + allocation);
    cursor = endSeconds;
    return {id: index + 1, startSeconds, endSeconds, text: phrase};
  });
}

function srtTime(seconds: number): string {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((milliseconds % 60_000) / 1000);
  const millis = milliseconds % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

export function captionsToSrt(cues: CaptionCue[]): string {
  return `${cues.map((cue) => `${cue.id}\n${srtTime(cue.startSeconds)} --> ${srtTime(cue.endSeconds)}\n${cue.text}`).join("\n\n")}\n`;
}
