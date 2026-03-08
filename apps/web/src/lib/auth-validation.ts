/**
 * Shared auth validation (client + server). Same rules as bootstrap script.
 * Password: min 8, max 15; >=1 uppercase; >=1 number; >=1 special; no spaces.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Special chars allowed in password (no blacklist; just need at least one). */
const SPECIAL_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

export type EmailResult = { ok: true; email: string } | { ok: false; error: string };
export type PasswordResult = { ok: true } | { ok: false; error: string };

export function validateEmail(input: string): EmailResult {
  const trimmed = input.trim();
  if (trimmed.length === 0) return { ok: false, error: "Email is required." };
  if (!EMAIL_REGEX.test(trimmed)) return { ok: false, error: "Invalid email format." };
  return { ok: true, email: trimmed.toLowerCase() };
}

export function validatePassword(password: string): PasswordResult {
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  if (password.length > 15) return { ok: false, error: "Password must be at most 15 characters." };
  if (/\s/.test(password)) return { ok: false, error: "Spaces are not allowed in password." };
  if (!/[A-Z]/.test(password)) return { ok: false, error: "Password must include at least one uppercase letter." };
  if (!/[0-9]/.test(password)) return { ok: false, error: "Password must include at least one number." };
  if (!SPECIAL_REGEX.test(password)) {
    return { ok: false, error: "Password must include at least one special character." };
  }
  return { ok: true };
}

/** Returns first error message or null if valid. For convenience in forms. */
export function getPasswordError(password: string): string | null {
  const r = validatePassword(password);
  return r.ok ? null : r.error;
}

export function getEmailError(input: string): string | null {
  const r = validateEmail(input);
  return r.ok ? null : r.error;
}
