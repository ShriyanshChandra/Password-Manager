/**
 * Secure Clipboard Manager with Automatic Wipe Timer
 *
 * Copies sensitive credentials to the system clipboard and schedules an
 * automatic wipe after `clearAfterSeconds` (default: 45s) to mitigate
 * clipboard snooping by malicious background apps or extensions.
 */

let clearTimer: ReturnType<typeof setTimeout> | null = null;
let lastCopiedSecret: string | null = null;

export async function copySecureToClipboard(
  text: string,
  clearAfterSeconds: number = 45
): Promise<void> {
  if (!text) return;

  await navigator.clipboard.writeText(text);
  lastCopiedSecret = text;

  // Cancel any previously scheduled wipe timer
  if (clearTimer) {
    clearTimeout(clearTimer);
  }

  // Schedule automatic clipboard wipe
  clearTimer = setTimeout(async () => {
    try {
      // If clipboard still holds this specific copied secret, overwrite it with empty string
      if (navigator.clipboard.readText) {
        const current = await navigator.clipboard.readText();
        if (current === lastCopiedSecret) {
          await navigator.clipboard.writeText('');
        }
      } else {
        await navigator.clipboard.writeText('');
      }
    } catch {
      // Fallback silent overwrite attempt
      try {
        await navigator.clipboard.writeText('');
      } catch {
        // Ignored
      }
    } finally {
      lastCopiedSecret = null;
      clearTimer = null;
    }
  }, clearAfterSeconds * 1000);
}
