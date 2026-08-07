/**
 * Generates a collision-resistant unique ID for a Task.
 *
 * IMPORTANT: `Date.now()` alone is NOT safe here — importing multiple Google
 * tasks calls this in a synchronous loop, so every call lands in the same
 * millisecond and returns the same value. Duplicate IDs caused a data-loss bug
 * where deleting one imported task deleted the entire batch (delete filters by
 * id). The random suffix guarantees uniqueness within a single millisecond.
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
