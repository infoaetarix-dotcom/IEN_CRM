import 'server-only';

const REDIRECT_ERROR_CODE = 'NEXT_REDIRECT';

/**
 * Every guard in this codebase (requireUser, requireRole, requireSuperAdmin,
 * requireFinanceAccess, requireStudentFinanceAccess...) rejects by calling
 * Next's redirect(), which *throws* rather than returning a value. That's
 * safe when a guard runs during page render — Next's framework catches the
 * throw and performs the HTTP redirect. It is NOT safe here: tool wrappers
 * call these same guarded actions mid-stream, after app/api/chatbot/route.ts
 * has already started returning a response. An uncaught redirect throw at
 * that point would hijack the whole response instead of yielding a clean
 * "you don't have permission" result back to the model.
 *
 * This is the exact mechanism that must fire when e.g. an agent asks the
 * assistant to add a plain Finance entry (admin-only) — the wrapped
 * createFinanceEntry() call throws a redirect, we catch it here, and the
 * tool call fails cleanly instead of crashing the stream.
 */
export async function runGuarded<T>(
  fn: () => Promise<T>,
): Promise<{ ok: true; result: T } | { ok: false; error: string }> {
  try {
    const result = await fn();
    return { ok: true, result };
  } catch (err) {
    if (isRedirectError(err)) {
      return { ok: false, error: "You don't have permission to do that." };
    }
    throw err;
  }
}

function isRedirectError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('digest' in error)) {
    return false;
  }
  const digest = (error as { digest: unknown }).digest;
  return typeof digest === 'string' && digest.startsWith(REDIRECT_ERROR_CODE);
}
