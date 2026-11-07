// AI image prompts for the dashboard's copy buttons. For illustrated projects the same style
// preset and character description are prepended to every prompt, so drawings stay consistent.
import type { Project, Scene } from "../../remotion/src/types";
import type { Character, CharacterLibrary } from "./api";

const stylePrompt = (project: Project, lib: CharacterLibrary | null) =>
  (project.stylePreset && lib?.styles[project.stylePreset]?.prompt) || "";

export const scenePrompt = (project: Project, scene: Scene, lib: CharacterLibrary | null): string | null => {
  const action = scene.visual.aiPrompt?.trim();
  if (project.style !== "illustrated") return action || null;
  const character = lib?.characters.find((c) => c.id === scene.character);
  const parts = [character?.description, action].filter(Boolean).join(", ");
  if (!parts) return null;
  return `${stylePrompt(project, lib)}, vertical 9:16 — ${parts}. No text, no letters.`;
};

export const sheetPrompt = (project: Project, character: Character, lib: CharacterLibrary | null) =>
  `${stylePrompt(project, lib)} — character reference sheet of ${character.description}: front view, ` +
  "three-quarter view and side view, full body, neutral pose, plain white background, no text, no labels.";
