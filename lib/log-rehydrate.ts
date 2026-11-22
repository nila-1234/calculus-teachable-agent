/**
 * Restores an event that /api/log had to store in its fallback shape.
 *
 * When Firestore rejects an event as-is (e.g. a nested array, or an oversize
 * payload), the log route stores it anyway with its payload as JSON text in
 * `data_json` and `data: null`, so nothing is lost. Every reader passes events
 * through here so those look exactly like any other event.
 */
export function rehydrateLog<T extends Record<string, unknown>>(raw: T): T {
  if (raw && raw.data == null && typeof raw.data_json === "string") {
    try {
      return { ...raw, data: JSON.parse(raw.data_json) };
    } catch {
      // Truncated text (payload over the size limit): keep what's readable.
      return { ...raw, data: { _unparsed: raw.data_json } };
    }
  }
  return raw;
}
