import {spawn} from "node:child_process";
import {createHash} from "node:crypto";
import {existsSync} from "node:fs";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {capture, resolveTool, run} from "./process.js";

export type RoughCutDecision = "keep" | "remove" | "review";
export type RoughCutAction = "plan" | "preview" | "master" | "run";
export type RoughCutLayout = "portrait-left" | "blur-background" | "contain" | "cover";

export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
};

export type RoughCutEntry = {
  id: string;
  source: string;
  sourceOrder: number;
  segmentIndex: number;
  startSeconds: number;
  endSeconds: number;
  text: string;
  decision: RoughCutDecision;
  reason: string;
  confidence: number;
};

export type MediaFacts = {
  source: string;
  durationSeconds: number;
  width: number;
  height: number;
  frameRate: number;
  codec: string;
  audioPresent: boolean;
  colorTransfer: string;
  colorPrimaries: string;
  colorSpace: string;
  hdr: boolean;
};

export type SilenceInterval = {
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
};

export type RoughCutPlan = {
  schemaVersion: 1;
  createdAt: string;
  settings: {
    language: string;
    model: string;
    silenceThresholdSeconds: number;
    retainedPauseSeconds: number;
    silenceNoiseDb: number;
    layout: RoughCutLayout;
    /** Extra source tail kept after the last spoken range so the cut does not hard-stop. */
    finalTailBufferSeconds?: number;
  };
  media: MediaFacts[];
  entries: RoughCutEntry[];
  silences?: Array<{source: string; intervals: SilenceInterval[]}>;
};

export type LocalRoughCutOptions = {
  repositoryRoot: string;
  projectRoot: string;
  action: RoughCutAction;
  inputs?: string[];
  language?: string;
  model?: string;
  silenceThresholdSeconds?: number;
  retainedPauseSeconds?: number;
  silenceNoiseDb?: number;
  finalTailBufferSeconds?: number;
  layout?: RoughCutLayout;
};

export type RepeatCandidate = {
  source: string;
  sourceOrder: number;
  earlierEntryId: string;
  laterEntryId: string;
  earlierStartSeconds: number;
  earlierEndSeconds: number;
  laterStartSeconds: number;
  laterEndSeconds: number;
  earlierText: string;
  laterText: string;
  similarity: number;
  overlapRatio: number;
  gapSeconds: number;
  kind: "exact-repeat" | "contained-repeat" | "near-repeat";
  recommendation: "prefer-later-after-listen";
};

type WhisperJson = {
  segments?: Array<{
    start?: number;
    end?: number;
    text?: string;
  }>;
};

type ProbeJson = {
  streams?: Array<{
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
    color_transfer?: string;
    color_primaries?: string;
    color_space?: string;
  }>;
  format?: {duration?: string};
};

const fixedFillerPattern = /^(?:呃+|额+|嗯+|啊+|um+|uh+|er+|ah+)$/iu;
const explicitRetakePattern = /(?:重新来|重来|再来一遍|说错了|不对[，。！？!?\s]*$)/u;

function assertFinitePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number.`);
}

function assertFiniteNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be zero or a positive number.`);
}

function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s，。！？、,.!?;；:：“”"'‘’（）()《》【】[\]-]/gu, "");
}

function bigrams(value: string): Set<string> {
  const result = new Set<string>();
  for (let index = 0; index < value.length - 1; index += 1) {
    result.add(value.slice(index, index + 2));
  }
  return result;
}

export function speechSimilarity(left: string, right: string): number {
  const a = normalizeSpeech(left);
  const b = normalizeSpeech(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const aPairs = bigrams(a);
  const bPairs = bigrams(b);
  if (aPairs.size === 0 || bPairs.size === 0) return 0;
  let overlap = 0;
  for (const item of aPairs) if (bPairs.has(item)) overlap += 1;
  return (2 * overlap) / (aPairs.size + bPairs.size);
}

/**
 * Returns the longest contiguous shared character span. Chinese ASR segments
 * often put a complete repeated sentence inside a longer segment, so a plain
 * whole-string similarity misses the duplicate. The transcript is short enough
 * that the O(n*m) dynamic pass is deterministic and inexpensive.
 */
function longestCommonSubstringLength(left: string, right: string): number {
  if (!left || !right) return 0;
  const previous = new Array<number>(right.length + 1).fill(0);
  let best = 0;
  for (let row = 1; row <= left.length; row += 1) {
    const current = new Array<number>(right.length + 1).fill(0);
    for (let column = 1; column <= right.length; column += 1) {
      if (left[row - 1] === right[column - 1]) {
        current[column] = previous[column - 1]! + 1;
        best = Math.max(best, current[column]!);
      }
    }
    for (let column = 0; column <= right.length; column += 1) previous[column] = current[column]!;
  }
  return best;
}

/**
 * Audit adjacent transcript segments for exact or partially-contained repeated
 * speech. This is an audit, not an automatic delete: a later take is preferred
 * only after listening confirms it is the complete/natural version.
 */
export function findRepeatCandidates(
  entries: RoughCutEntry[],
  maxGapSeconds = 45,
  minPhraseLength = 5,
): RepeatCandidate[] {
  const candidates: RepeatCandidate[] = [];
  const ordered = entries
    .filter((entry) => entry.decision !== "remove")
    .slice()
    .sort((left, right) => left.startSeconds - right.startSeconds);
  for (let index = 0; index < ordered.length; index += 1) {
    const earlier = ordered[index]!;
    const a = normalizeSpeech(earlier.text);
    if (a.length < minPhraseLength) continue;
    for (let next = index + 1; next < ordered.length; next += 1) {
      const later = ordered[next]!;
      if (later.sourceOrder !== earlier.sourceOrder || later.source !== earlier.source) continue;
      const gapSeconds = Math.max(0, later.startSeconds - earlier.endSeconds);
      if (gapSeconds > maxGapSeconds) break;
      const b = normalizeSpeech(later.text);
      if (b.length < minPhraseLength) continue;
      const shorter = Math.min(a.length, b.length);
      const overlapRatio = longestCommonSubstringLength(a, b) / shorter;
      const similarity = speechSimilarity(earlier.text, later.text);
      const contained = a.includes(b) || b.includes(a);
      const exact = similarity >= 0.9;
      // ASR can differ on one or two characters (e.g. "排埔" vs "排盘")
      // even when the sentence is clearly repeated. The contiguous overlap
      // carries the primary signal; the lower bigram floor avoids rejecting
      // these common transcription variants without making short phrases
      // automatic deletions.
      const near = overlapRatio >= 0.72 && similarity >= 0.35;
      if (!exact && !contained && !near) continue;
      candidates.push({
        source: earlier.source,
        sourceOrder: earlier.sourceOrder,
        earlierEntryId: earlier.id,
        laterEntryId: later.id,
        earlierStartSeconds: earlier.startSeconds,
        earlierEndSeconds: earlier.endSeconds,
        laterStartSeconds: later.startSeconds,
        laterEndSeconds: later.endSeconds,
        earlierText: earlier.text,
        laterText: later.text,
        similarity,
        overlapRatio,
        gapSeconds,
        kind: exact ? "exact-repeat" : contained ? "contained-repeat" : "near-repeat",
        recommendation: "prefer-later-after-listen",
      });
    }
  }
  return candidates;
}

export function createRoughCutEntries(
  sources: Array<{source: string; sourceOrder: number; segments: TranscriptSegment[]}>,
): RoughCutEntry[] {
  const entries: RoughCutEntry[] = [];
  for (const source of sources) {
    source.segments.forEach((segment, segmentIndex) => {
      const text = segment.text.trim();
      const normalized = normalizeSpeech(text);
      let decision: RoughCutDecision = "keep";
      let reason = "spoken-content";
      let confidence = 0.98;

      if (fixedFillerPattern.test(normalized) && segment.end - segment.start <= 1.5) {
        decision = "remove";
        reason = "fixed-filler";
        confidence = 0.99;
      } else if (explicitRetakePattern.test(text)) {
        decision = "review";
        reason = "explicit-retake-marker";
        confidence = 0.92;
      }

      const recent = entries
        .filter((entry) => entry.sourceOrder === source.sourceOrder)
        .slice(-4);
      const duplicate = recent.find((entry) =>
        normalized.length >= 6 && speechSimilarity(entry.text, text) >= 0.9
      );
      if (duplicate && decision !== "remove") {
        decision = "review";
        reason = "possible-repeated-take";
        confidence = 0.86;
      }

      entries.push({
        id: `s${String(source.sourceOrder + 1).padStart(2, "0")}-${String(segmentIndex + 1).padStart(4, "0")}`,
        source: source.source,
        sourceOrder: source.sourceOrder,
        segmentIndex,
        startSeconds: Math.max(0, segment.start),
        endSeconds: segment.end,
        text,
        decision,
        reason,
        confidence,
      });
    });
  }
  // Run a second, transcript-wide pass so a duplicate sentence embedded in a
  // longer Whisper segment is still surfaced. Keep both takes audible until a
  // human/Codex confirms the later complete attempt.
  const repeatCandidates = findRepeatCandidates(entries);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  for (const candidate of repeatCandidates) {
    const later = byId.get(candidate.laterEntryId);
    if (later && later.decision === "keep") {
      later.decision = "review";
      later.reason = "possible-repeated-take";
      later.confidence = Math.min(later.confidence, 0.86);
    }
  }
  return entries;
}

export type PlayableRange = {
  source: string;
  sourceOrder: number;
  startSeconds: number;
  endSeconds: number;
  entryIds: string[];
};

export function buildPlayableRanges(
  entries: RoughCutEntry[],
  sourceDurations: Map<string, number>,
  retainedPauseSeconds = 0.35,
  mergeGapSeconds = 0.8,
  silenceReport: Array<{source: string; intervals: SilenceInterval[]}> = [],
  finalTailBufferSeconds = 0.5,
): PlayableRange[] {
  assertFinitePositive(retainedPauseSeconds, "retainedPauseSeconds");
  assertFinitePositive(mergeGapSeconds, "mergeGapSeconds");
  assertFiniteNonNegative(finalTailBufferSeconds, "finalTailBufferSeconds");
  const ranges: PlayableRange[] = [];
  let current: PlayableRange | undefined;
  const sidePadding = retainedPauseSeconds / 2;

  const flush = () => {
    if (current && current.endSeconds > current.startSeconds) ranges.push(current);
    current = undefined;
  };

  const silenceBySource = new Map(silenceReport.map((item) => [item.source, item.intervals]));

  const splitAtSilences = (entry: RoughCutEntry): Array<{startSeconds: number; endSeconds: number}> => {
    const intervals = (silenceBySource.get(entry.source) ?? [])
      .filter((silence) => silence.endSeconds > entry.startSeconds && silence.startSeconds < entry.endSeconds)
      .sort((left, right) => left.startSeconds - right.startSeconds);
    if (intervals.length === 0) return [{startSeconds: entry.startSeconds, endSeconds: entry.endSeconds}];

    const chunks: Array<{startSeconds: number; endSeconds: number}> = [];
    let cursor = entry.startSeconds;
    const keepHalf = retainedPauseSeconds / 2;
    for (const silence of intervals) {
      const start = Math.max(entry.startSeconds, silence.startSeconds);
      const end = Math.min(entry.endSeconds, silence.endSeconds);
      if (end <= start) continue;
      const keepBefore = start <= entry.startSeconds + 0.01 ? entry.startSeconds : start + keepHalf;
      if (keepBefore > cursor) chunks.push({startSeconds: cursor, endSeconds: keepBefore});
      cursor = end >= entry.endSeconds - 0.01 ? entry.endSeconds : end - keepHalf;
    }
    if (cursor < entry.endSeconds) chunks.push({startSeconds: cursor, endSeconds: entry.endSeconds});
    return chunks.filter((chunk) => chunk.endSeconds > chunk.startSeconds);
  };

  for (const entry of entries) {
    if (!["keep", "remove", "review"].includes(entry.decision)) {
      throw new Error(`Invalid decision "${String(entry.decision)}" for ${entry.id}.`);
    }
    if (entry.decision === "remove") {
      flush();
      continue;
    }
    const duration = sourceDurations.get(entry.source);
    if (!duration) throw new Error(`Missing media duration for ${entry.source}.`);
    const chunks = splitAtSilences(entry);
    chunks.forEach((chunk, chunkIndex) => {
      // A long silence inside one Whisper segment is a real cut barrier. Keep a
      // short breath on both sides, but do not merge the two speech chunks back.
      if (chunkIndex > 0) flush();
      const startSeconds = Math.max(0, chunk.startSeconds - sidePadding);
      const endSeconds = Math.min(duration, chunk.endSeconds + sidePadding);
      if (
        current &&
        current.source === entry.source &&
        startSeconds - current.endSeconds <= mergeGapSeconds
      ) {
        current.endSeconds = Math.max(current.endSeconds, endSeconds);
        current.entryIds.push(entry.id);
      } else {
        flush();
        current = {
          source: entry.source,
          sourceOrder: entry.sourceOrder,
          startSeconds,
          endSeconds,
          entryIds: [entry.id],
        };
      }
    });
  }
  flush();
  if (ranges.length > 0 && finalTailBufferSeconds > 0) {
    const last = ranges[ranges.length - 1]!;
    const duration = sourceDurations.get(last.source);
    if (duration) {
      // `sidePadding` already contributes a small post-speech breath. Add only
      // the remainder so the total tail is approximately the requested value.
      const additionalTail = Math.max(0, finalTailBufferSeconds - sidePadding);
      last.endSeconds = Math.min(duration, last.endSeconds + additionalTail);
    }
  }
  return ranges;
}

function repeatAuditMarkdown(candidates: RepeatCandidate[]): string {
  if (candidates.length === 0) {
    return [
      "# 重复句审计",
      "",
      "本轮 Whisper 字幕未发现满足阈值的相邻重复表达。仍需在最终粗剪后回听结尾和转场。",
      "",
    ].join("\n");
  }
  const rows = candidates.map((candidate, index) => [
    `${index + 1}`,
    candidate.kind,
    `${formatTime(candidate.earlierStartSeconds)} → ${formatTime(candidate.earlierEndSeconds)}`,
    `${formatTime(candidate.laterStartSeconds)} → ${formatTime(candidate.laterEndSeconds)}`,
    `${candidate.earlierText} / ${candidate.laterText}`,
    "优先后一句，先听完整度再删除前一句",
  ].join(" | "));
  return [
    "# 重复句审计",
    "",
    "本文件来自视频实际 Whisper 字幕，不使用参考文案替代音频。候选项先人工回听；确认是同一意思的重录时，默认保留后一句。",
    "",
    "| # | 类型 | 前一句 | 后一句 | 识别文本 | 建议 |",
    "|---:|---|---|---|---|---|",
    ...rows.map((row) => `| ${row} |`),
    "",
  ].join("\n");
}

async function captureProcess(command: string, args: string[], cwd: string): Promise<{stdout: string; stderr: string}> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {cwd, shell: false});
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => stdout += chunk);
    child.stderr.setEncoding("utf8").on("data", (chunk) => stderr += chunk);
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve({stdout, stderr});
      else reject(new Error(`${command} exited with code ${code}: ${stderr.trim()}`));
    });
  });
}

function parseRate(value = "0/1"): number {
  const [numerator = "0", denominator = "1"] = value.split("/");
  const divisor = Number(denominator);
  return divisor === 0 ? 0 : Number(numerator) / divisor;
}

async function probeMedia(source: string, repositoryRoot: string): Promise<MediaFacts> {
  const ffprobe = resolveTool("ffprobe", "Gyan.FFmpeg_");
  const raw = await capture(ffprobe, [
    "-v", "error",
    "-show_entries", "format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,color_transfer,color_primaries,color_space",
    "-of", "json",
    source,
  ], repositoryRoot);
  const probe = JSON.parse(raw) as ProbeJson;
  const video = probe.streams?.find((stream) => stream.codec_type === "video");
  const audioPresent = probe.streams?.some((stream) => stream.codec_type === "audio") ?? false;
  const durationSeconds = Number(probe.format?.duration ?? 0);
  if (!video || !durationSeconds) throw new Error(`Unreadable video source: ${source}`);
  if (!audioPresent) throw new Error(`Talking-head source has no audio: ${source}`);
  const colorTransfer = video.color_transfer ?? "unknown";
  return {
    source,
    durationSeconds,
    width: video.width ?? 0,
    height: video.height ?? 0,
    frameRate: parseRate(video.r_frame_rate),
    codec: video.codec_name ?? "unknown",
    audioPresent,
    colorTransfer,
    colorPrimaries: video.color_primaries ?? "unknown",
    colorSpace: video.color_space ?? "unknown",
    hdr: ["arib-std-b67", "smpte2084"].includes(colorTransfer),
  };
}

function parseSilences(stderr: string): SilenceInterval[] {
  const starts: number[] = [];
  const results: SilenceInterval[] = [];
  for (const line of stderr.split(/\r?\n/)) {
    const startMatch = line.match(/silence_start:\s*([\d.]+)/);
    if (startMatch) starts.push(Number(startMatch[1]));
    const endMatch = line.match(/silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/);
    if (endMatch) {
      const endSeconds = Number(endMatch[1]);
      const durationSeconds = Number(endMatch[2]);
      results.push({
        startSeconds: starts.shift() ?? Math.max(0, endSeconds - durationSeconds),
        endSeconds,
        durationSeconds,
      });
    }
  }
  return results;
}

async function detectSilences(
  source: string,
  repositoryRoot: string,
  noiseDb: number,
  thresholdSeconds: number,
): Promise<SilenceInterval[]> {
  const ffmpeg = resolveTool("ffmpeg", "Gyan.FFmpeg_");
  const result = await captureProcess(ffmpeg, [
    "-hide_banner", "-nostdin", "-i", source,
    "-vn",
    "-af", `silencedetect=noise=${noiseDb}dB:d=${thresholdSeconds}`,
    "-f", "null", "-",
  ], repositoryRoot);
  return parseSilences(result.stderr);
}

function safeStem(source: string): string {
  return path.parse(source).name.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 80);
}

async function transcribe(
  source: string,
  index: number,
  roughRoot: string,
  repositoryRoot: string,
  language: string,
  model: string,
): Promise<TranscriptSegment[]> {
  const outputDirectory = path.join(
    roughRoot,
    "transcripts",
    `${String(index + 1).padStart(2, "0")}-${safeStem(source)}`,
  );
  await mkdir(outputDirectory, {recursive: true});
  await run("powershell.exe", [
    "-NoProfile", "-ExecutionPolicy", "Bypass",
    "-File", path.join(repositoryRoot, "scripts", "whisper.ps1"),
    "-InputPath", source,
    "-Language", language,
    "-Model", model,
    "-OutputDir", outputDirectory,
    "-OutputFormat", "all",
  ], repositoryRoot);
  const jsonPath = path.join(outputDirectory, `${path.parse(source).name}.json`);
  if (!existsSync(jsonPath)) throw new Error(`Whisper JSON output is missing: ${jsonPath}`);
  const parsed = JSON.parse(await readFile(jsonPath, "utf8")) as WhisperJson;
  const segments = (parsed.segments ?? [])
    .map((segment) => ({
      start: Number(segment.start ?? 0),
      end: Number(segment.end ?? 0),
      text: String(segment.text ?? "").trim(),
    }))
    .filter((segment) => segment.text && segment.end > segment.start);
  if (segments.length === 0) throw new Error(`Whisper returned no spoken segments for ${source}.`);
  return segments;
}

function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  const milliseconds = Math.round((seconds - whole) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

function transcriptMarkdown(plan: RoughCutPlan): string {
  const rows = plan.entries.map((entry) => {
    const marker = entry.decision === "keep" ? "保留" : entry.decision === "remove" ? "删除" : "复核";
    return `- **${marker}** \`${entry.id}\` ${formatTime(entry.startSeconds)} → ${formatTime(entry.endSeconds)}  \n  ${entry.text}  \n  原因：${entry.reason}`;
  });
  return [
    "# 本地粗剪文字稿",
    "",
    "说明：`删除` 只用于明确填充音；`复核` 默认仍会保留在预览中。需要调整时修改 `cut-list.json` 的 `decision`。",
    "",
    ...rows,
    "",
  ].join("\n");
}

async function writePlanArtifacts(
  options: Required<Pick<LocalRoughCutOptions,
    "repositoryRoot" | "projectRoot" | "language" | "model" |
    "silenceThresholdSeconds" | "retainedPauseSeconds" | "silenceNoiseDb" | "finalTailBufferSeconds" | "layout"
  >> & {inputs: string[]},
): Promise<RoughCutPlan> {
  if (options.inputs.length === 0) throw new Error("At least one local talking-head input is required.");
  assertFinitePositive(options.silenceThresholdSeconds, "silenceThresholdSeconds");
  assertFinitePositive(options.retainedPauseSeconds, "retainedPauseSeconds");
  assertFiniteNonNegative(options.finalTailBufferSeconds, "finalTailBufferSeconds");
  const roughRoot = path.join(options.projectRoot, "rough-cut");
  await mkdir(roughRoot, {recursive: true});

  const media: MediaFacts[] = [];
  const transcribed: Array<{source: string; sourceOrder: number; segments: TranscriptSegment[]}> = [];
  const silenceReport: Array<{source: string; intervals: SilenceInterval[]}> = [];

  for (let index = 0; index < options.inputs.length; index += 1) {
    const source = path.resolve(options.inputs[index]!);
    if (!existsSync(source)) throw new Error(`Local input does not exist: ${source}`);
    const facts = await probeMedia(source, options.repositoryRoot);
    const [segments, intervals] = await Promise.all([
      transcribe(source, index, roughRoot, options.repositoryRoot, options.language, options.model),
      detectSilences(source, options.repositoryRoot, options.silenceNoiseDb, options.silenceThresholdSeconds),
    ]);
    media.push(facts);
    transcribed.push({source, sourceOrder: index, segments});
    silenceReport.push({source, intervals});
  }

  const plan: RoughCutPlan = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    settings: {
      language: options.language,
      model: options.model,
      silenceThresholdSeconds: options.silenceThresholdSeconds,
      retainedPauseSeconds: options.retainedPauseSeconds,
      silenceNoiseDb: options.silenceNoiseDb,
      layout: options.layout,
      finalTailBufferSeconds: options.finalTailBufferSeconds,
    },
    media,
    entries: createRoughCutEntries(transcribed),
    silences: silenceReport,
  };
  const analysis = {
    schemaVersion: 1,
    localOnly: true,
    externalUploadUsed: false,
    media,
    silences: silenceReport,
  };
  await writeFile(path.join(roughRoot, "analysis.json"), `${JSON.stringify(analysis, null, 2)}\n`, "utf8");
  await writeFile(path.join(roughRoot, "cut-list.json"), `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  await writeFile(path.join(roughRoot, "transcript.md"), transcriptMarkdown(plan), "utf8");
  const repeatCandidates = findRepeatCandidates(plan.entries);
  await writeFile(path.join(roughRoot, "repeat-audit.json"), `${JSON.stringify({
    schemaVersion: 1,
    generatedFrom: "whisper-transcript",
    candidateCount: repeatCandidates.length,
    candidates: repeatCandidates,
  }, null, 2)}\n`, "utf8");
  await writeFile(path.join(roughRoot, "repeat-audit.md"), repeatAuditMarkdown(repeatCandidates), "utf8");
  return plan;
}

function videoFilter(
  facts: MediaFacts,
  width: number,
  height: number,
  layout: RoughCutLayout,
): {filter: string; mapLabel: string} {
  const toneMap = facts.hdr
    ? "zscale=t=linear:npl=1000,format=gbrpf32le,tonemap=tonemap=mobius:desat=0,zscale=p=bt709:t=bt709:m=bt709:r=tv,format=yuv420p,"
    : "";
  const portrait = facts.height > facts.width;
  if (portrait && ["portrait-left", "blur-background"].includes(layout)) {
    const foregroundHeight = Math.round(height * 0.94);
    const x = layout === "portrait-left" ? Math.round(width * 0.055) : "(W-w)/2";
    return {
      filter:
        `[0:v]${toneMap}split=2[bg][fg];` +
        `[bg]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},gblur=sigma=28[bg2];` +
        `[fg]scale=-2:${foregroundHeight}:force_original_aspect_ratio=decrease[fg2];` +
        `[bg2][fg2]overlay=x=${x}:y=(H-h)/2,format=yuv420p[v]`,
      mapLabel: "[v]",
    };
  }
  if (layout === "contain") {
    return {
      filter: `[0:v]${toneMap}scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p[v]`,
      mapLabel: "[v]",
    };
  }
  return {
    filter: `[0:v]${toneMap}scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},format=yuv420p[v]`,
    mapLabel: "[v]",
  };
}

async function validateRenderedRoughCut(
  output: string,
  repositoryRoot: string,
  expectedWidth: number,
  expectedHeight: number,
): Promise<void> {
  const ffprobe = resolveTool("ffprobe", "Gyan.FFmpeg_");
  const raw = await capture(ffprobe, [
    "-v", "error",
    "-show_entries", "format=duration:stream=codec_type,codec_name,width,height,sample_rate",
    "-of", "json",
    output,
  ], repositoryRoot);
  const parsed = JSON.parse(raw) as ProbeJson & {streams?: Array<ProbeJson["streams"] extends Array<infer T> ? T & {sample_rate?: string} : never>};
  const video = parsed.streams?.find((stream) => stream.codec_type === "video");
  const audio = parsed.streams?.find((stream) => stream.codec_type === "audio");
  if (!video || video.width !== expectedWidth || video.height !== expectedHeight) {
    throw new Error(`Rough-cut render has invalid dimensions: ${output}`);
  }
  if (!audio) throw new Error(`Rough-cut render has no audio: ${output}`);
  if (Number(parsed.format?.duration ?? 0) <= 0) throw new Error(`Rough-cut render has invalid duration: ${output}`);
}

async function renderPlan(
  repositoryRoot: string,
  projectRoot: string,
  quality: "preview" | "master",
): Promise<string> {
  const roughRoot = path.join(projectRoot, "rough-cut");
  const cutListPath = path.join(roughRoot, "cut-list.json");
  if (!existsSync(cutListPath)) throw new Error(`Missing rough-cut decision file: ${cutListPath}`);
  const plan = JSON.parse(await readFile(cutListPath, "utf8")) as RoughCutPlan;
  if (!plan.silences) {
    const analysisPath = path.join(roughRoot, "analysis.json");
    if (existsSync(analysisPath)) {
      const analysis = JSON.parse(await readFile(analysisPath, "utf8")) as {
        silences?: Array<{source: string; intervals: SilenceInterval[]}>;
      };
      plan.silences = analysis.silences ?? [];
    }
  }
  if (plan.schemaVersion !== 1 || !Array.isArray(plan.entries) || !Array.isArray(plan.media)) {
    throw new Error(`Invalid rough-cut decision file: ${cutListPath}`);
  }
  const sourceDurations = new Map(plan.media.map((item) => [item.source, item.durationSeconds]));
  const ranges = buildPlayableRanges(
    plan.entries,
    sourceDurations,
    plan.settings.retainedPauseSeconds,
    0.8,
    plan.silences ?? [],
    plan.settings.finalTailBufferSeconds ?? 0.5,
  );
  if (ranges.length === 0) throw new Error("The reviewed cut list contains no playable ranges.");

  const width = quality === "preview" ? 1280 : 1920;
  const height = quality === "preview" ? 720 : 1080;
  const crf = quality === "preview" ? "25" : "18";
  const preset = quality === "preview" ? "veryfast" : "medium";
  const ffmpeg = resolveTool("ffmpeg", "Gyan.FFmpeg_");
  const runId = createHash("sha256").update(projectRoot).digest("hex").slice(0, 12);
  const projectId = path.basename(path.resolve(projectRoot));
  const temporaryRoot = path.join(repositoryRoot, ".tmp", "projects", projectId, "local-rough-cut", runId, quality);
  await mkdir(temporaryRoot, {recursive: true});
  const clips: string[] = [];

  for (let index = 0; index < ranges.length; index += 1) {
    const range = ranges[index]!;
    const facts = plan.media.find((item) => item.source === range.source);
    if (!facts) throw new Error(`Missing media facts for ${range.source}.`);
    if (!existsSync(range.source)) throw new Error(`Original local source is missing: ${range.source}`);
    const clipPath = path.join(temporaryRoot, `clip-${String(index + 1).padStart(5, "0")}.mp4`);
    const layout = videoFilter(facts, width, height, plan.settings.layout);
    await run(ffmpeg, [
      "-y", "-hide_banner", "-nostdin",
      "-ss", range.startSeconds.toFixed(3),
      "-to", range.endSeconds.toFixed(3),
      "-i", range.source,
      "-filter_complex", `${layout.filter};[0:a]aresample=48000,asetpts=PTS-STARTPTS[a]`,
      "-map", layout.mapLabel,
      "-map", "[a]",
      "-r", "30",
      "-c:v", "libx264",
      "-preset", preset,
      "-crf", crf,
      "-pix_fmt", "yuv420p",
      "-color_primaries", "bt709",
      "-color_trc", "bt709",
      "-colorspace", "bt709",
      "-c:a", "aac",
      "-b:a", "192k",
      "-ar", "48000",
      "-movflags", "+faststart",
      clipPath,
    ], repositoryRoot);
    clips.push(clipPath);
  }

  const concatPath = path.join(temporaryRoot, "concat.txt");
  const concatBody = clips
    .map((clip) => `file '${clip.replaceAll("\\", "/").replaceAll("'", "'\\''")}'`)
    .join("\n");
  await writeFile(concatPath, `${concatBody}\n`, "utf8");
  const output = path.join(roughRoot, quality === "preview" ? "preview.mp4" : "a-roll-rough-cut.mp4");
  await run(ffmpeg, [
    "-y", "-hide_banner", "-nostdin",
    "-f", "concat", "-safe", "0", "-i", concatPath,
    "-c", "copy", "-movflags", "+faststart",
    output,
  ], repositoryRoot);
  await validateRenderedRoughCut(output, repositoryRoot, width, height);
  return output;
}

export async function runLocalRoughCut(options: LocalRoughCutOptions): Promise<{
  action: RoughCutAction;
  roughRoot: string;
  output?: string;
}> {
  const repositoryRoot = path.resolve(options.repositoryRoot);
  const projectRoot = path.resolve(repositoryRoot, options.projectRoot);
  const roughRoot = path.join(projectRoot, "rough-cut");
  const language = options.language ?? "zh";
  const model = options.model ?? "base";
  const silenceThresholdSeconds = options.silenceThresholdSeconds ?? 0.9;
  const retainedPauseSeconds = options.retainedPauseSeconds ?? 0.35;
  const silenceNoiseDb = options.silenceNoiseDb ?? -35;
  const finalTailBufferSeconds = options.finalTailBufferSeconds ?? 0.5;
  const layout = options.layout ?? "portrait-left";

  if (["plan", "run"].includes(options.action)) {
    await writePlanArtifacts({
      repositoryRoot,
      projectRoot,
      inputs: options.inputs ?? [],
      language,
      model,
      silenceThresholdSeconds,
      retainedPauseSeconds,
      silenceNoiseDb,
      finalTailBufferSeconds,
      layout,
    });
  }
  if (options.action === "preview" || options.action === "run") {
    return {action: options.action, roughRoot, output: await renderPlan(repositoryRoot, projectRoot, "preview")};
  }
  if (options.action === "master") {
    return {action: options.action, roughRoot, output: await renderPlan(repositoryRoot, projectRoot, "master")};
  }
  return {action: options.action, roughRoot};
}
