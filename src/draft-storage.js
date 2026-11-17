const DRAFT_KEY = "houshyar.chat.draft.v1";
const MAX_DRAFT_LENGTH = 6000;

export function loadDraft(storage = globalThis.localStorage) {
  try {
    const value = storage?.getItem(DRAFT_KEY);
    return typeof value === "string" ? value.slice(0, MAX_DRAFT_LENGTH) : "";
  } catch {
    return "";
  }
}

export function saveDraft(value, storage = globalThis.localStorage) {
  try {
    if (typeof value !== "string" || !value) {
      storage?.removeItem(DRAFT_KEY);
      return true;
    }
    storage?.setItem(DRAFT_KEY, value.slice(0, MAX_DRAFT_LENGTH));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(DRAFT_KEY);
    return true;
  } catch {
    return false;
  }
}
