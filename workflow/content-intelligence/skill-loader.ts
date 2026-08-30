import {readFile} from "node:fs/promises";
import path from "node:path";

const knownSkills = new Set([
  "viral_video",
  "cinematic_video",
  "knowledge_creator",
  "product_launch",
  "personal_ip",
  "chinese_culture",
  "shortform_copywriting",
]);

export type LoadedSkill = {
  id: string;
  source: string;
};

export async function loadSkill(repositoryRoot: string, skillId: string): Promise<LoadedSkill> {
  if (!knownSkills.has(skillId)) throw new Error(`Unknown skill "${skillId}".`);
  const source = await readFile(path.join(repositoryRoot, "skills", skillId, "skill.md"), "utf8");
  for (const heading of ["## 适用场景", "## 内容规则", "## 视觉规则", "## 语言规则", "## 禁忌"]) {
    if (!source.includes(heading)) throw new Error(`Skill ${skillId} is missing required section: ${heading}`);
  }
  return {id: skillId, source};
}

export async function loadSkills(repositoryRoot: string, skillIds: string[]): Promise<LoadedSkill[]> {
  return await Promise.all(skillIds.map((skillId) => loadSkill(repositoryRoot, skillId)));
}
