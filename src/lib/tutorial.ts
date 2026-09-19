const KEY = "jev-arcade:tetris-controls";

function storageMessage(error: unknown): string {
  if (
    !(error instanceof DOMException) ||
    !["SecurityError", "QuotaExceededError"].includes(error.name)
  )
    throw error;
  return "Browser storage is unavailable. This preference cannot be saved.";
}

export function readTutorialPreference() {
  try {
    return { seen: localStorage.getItem(KEY) === "seen", error: "" };
  } catch (error) {
    return { seen: false, error: storageMessage(error) };
  }
}

export function saveTutorialPreference() {
  try {
    localStorage.setItem(KEY, "seen");
    return "";
  } catch (error) {
    return storageMessage(error);
  }
}
