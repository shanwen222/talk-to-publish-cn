import type {ProjectSpec} from "./types.js";

export type ViralReport = {
  version: "v2";
  hook: {windowSeconds: 3; text: string; rule: string};
  pacing: Array<{sceneId: string; startSeconds: number; durationSeconds: number}>;
  emotionCurve: string[];
  cta: {text: string; placement: "final-scene"};
};

export function optimizeViralStructure(spec: ProjectSpec): {spec: ProjectSpec; report: ViralReport} {
  const first = spec.scenes[0];
  const last = spec.scenes.at(-1);
  if (!first || !last) throw new Error("Viral Agent requires at least one scene.");
  const hook = first.subtitle.length <= 24 ? first.subtitle : `${first.subtitle.slice(0, 23)}…`;
  const optimized: ProjectSpec = {
    ...spec,
    hook,
    cta: last.subtitle,
    emotionCurve: spec.scenes.map((scene) => scene.emotion ?? "confidence"),
    scenes: spec.scenes.map((scene, index) => index === 0 ? {...scene, subtitle: hook} : scene),
  };
  return {
    spec: optimized,
    report: {
      version: "v2",
      hook: {windowSeconds: 3, text: hook, rule: "首屏短句、冲突或认知差，3 秒内完成呈现"},
      pacing: optimized.scenes.map(({id: sceneId, startSeconds, durationSeconds}) => ({sceneId, startSeconds, durationSeconds})),
      emotionCurve: optimized.emotionCurve ?? [],
      cta: {text: optimized.cta, placement: "final-scene"},
    },
  };
}

export function viralReportMarkdown(report: ViralReport): string {
  return `# Viral Agent 优化报告\n\n- 前 3 秒 Hook：${report.hook.text}\n- Hook 规则：${report.hook.rule}\n- 情绪曲线：${report.emotionCurve.join(" → ")}\n- CTA：${report.cta.text}\n\n## 节奏\n\n${report.pacing.map((beat, index) => `${index + 1}. ${beat.startSeconds}-${beat.startSeconds + beat.durationSeconds}s（${beat.durationSeconds}s）`).join("\n")}\n`;
}
