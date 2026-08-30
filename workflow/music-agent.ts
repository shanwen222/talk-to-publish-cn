import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {resolveTool, run} from "./process.js";

export type MusicStyle = "technology" | "documentary" | "emotion" | "cinematic";
type MusicProfile = {style: MusicStyle; frequencies: [number, number, number]; bgmGain: number; fadeInSeconds: number; fadeOutSeconds: number; targetLufs: number};

const profiles: Record<MusicStyle, MusicProfile> = {
  technology: {style: "technology", frequencies: [55, 110, 330], bgmGain: 0.42, fadeInSeconds: 1.5, fadeOutSeconds: 3, targetLufs: -24},
  documentary: {style: "documentary", frequencies: [65, 130, 196], bgmGain: 0.38, fadeInSeconds: 2, fadeOutSeconds: 4, targetLufs: -25},
  emotion: {style: "emotion", frequencies: [73, 147, 220], bgmGain: 0.34, fadeInSeconds: 3, fadeOutSeconds: 5, targetLufs: -26},
  cinematic: {style: "cinematic", frequencies: [41, 82, 247], bgmGain: 0.46, fadeInSeconds: 2, fadeOutSeconds: 4, targetLufs: -23},
};

export function selectMusicProfile(style: MusicStyle): MusicProfile {
  const profile = profiles[style];
  if (!profile) throw new Error(`Unsupported music style: ${style}`);
  return profile;
}

export async function createMusicMix(projectRoot: string, repositoryRoot: string, style: MusicStyle, durationSeconds: number): Promise<string> {
  const profile = selectMusicProfile(style);
  const audioRoot = path.join(projectRoot, "assets", "audio");
  const voice = path.join(projectRoot, "voice", "voice.mp3");
  const bgm = path.join(audioRoot, "bgm.mp3");
  const mix = path.join(audioRoot, "final-mix.m4a");
  await mkdir(audioRoot, {recursive: true});
  const ffmpeg = resolveTool("ffmpeg", "Gyan.FFmpeg_");
  const inputs = profile.frequencies.flatMap((frequency) => ["-f", "lavfi", "-i", `sine=frequency=${frequency}:duration=${durationSeconds}:sample_rate=48000`]);
  await run(ffmpeg, [
    "-hide_banner", "-loglevel", "warning", "-y", ...inputs,
    "-filter_complex",
    `[0:a]volume=0.18,tremolo=f=0.16:d=0.55[a0];[1:a]volume=0.09,tremolo=f=0.31:d=0.38[a1];[2:a]volume=0.035,tremolo=f=0.47:d=0.3[a2];[a0][a1][a2]amix=inputs=3:normalize=0,highpass=f=35,lowpass=f=4200,afade=t=in:st=0:d=${profile.fadeInSeconds},afade=t=out:st=${durationSeconds - profile.fadeOutSeconds}:d=${profile.fadeOutSeconds},loudnorm=I=${profile.targetLufs}:TP=-3:LRA=7[a]`,
    "-map", "[a]", "-codec:a", "libmp3lame", "-b:a", "192k", bgm,
  ], repositoryRoot);
  await run(ffmpeg, [
    "-hide_banner", "-loglevel", "warning", "-y", "-i", voice, "-stream_loop", "-1", "-i", bgm,
    "-filter_complex",
    `[0:a]apad=pad_dur=${durationSeconds},atrim=0:${durationSeconds},asplit=2[side][voice];[1:a]atrim=0:${durationSeconds},volume=${profile.bgmGain}[bg];[bg][side]sidechaincompress=threshold=0.025:ratio=12:attack=12:release=360[ducked];[voice][ducked]amix=inputs=2:duration=longest:normalize=0:dropout_transition=2,loudnorm=I=-16:TP=-1.5:LRA=9[mix]`,
    "-map", "[mix]", "-t", String(durationSeconds), "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", mix,
  ], repositoryRoot);
  await writeFile(path.join(audioRoot, "music.json"), `${JSON.stringify({
    schemaVersion: "v2", ...profile, voicePriority: true, ducking: {threshold: 0.025, ratio: 12, attackMs: 12, releaseMs: 360},
    outputs: {bgm: "assets/audio/bgm.mp3", mix: "assets/audio/final-mix.m4a"},
  }, null, 2)}\n`, "utf8");
  return mix;
}
