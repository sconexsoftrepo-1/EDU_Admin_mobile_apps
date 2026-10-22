import {
  type AnimationMode,
  type AnimationTemplateId,
  templateFromPath,
} from "../config/animationRegistry";
export function chooseAnimationMode({
  id,
  previousPath,
  documentEntry,
  reload,
  visited,
  history,
}: {
  id: AnimationTemplateId;
  previousPath: string | null;
  documentEntry: boolean;
  reload: boolean;
  visited: boolean;
  history: boolean;
}): AnimationMode | null {
  if (history) return null;
  if (previousPath && templateFromPath(previousPath) === id) return null;
  if (documentEntry && reload && visited) return "refresh";
  return visited ? null : "initial";
}
export function hasVisited(id: AnimationTemplateId) {
  try {
    return sessionStorage.getItem(`dentalverse-${id}`) === "1";
  } catch {
    return false;
  }
}
export function markVisited(id: AnimationTemplateId) {
  try {
    sessionStorage.setItem(`dentalverse-${id}`, "1");
  } catch {}
}
