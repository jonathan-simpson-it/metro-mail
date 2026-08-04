import { Resend } from "resend";

let client: Resend | null = null;

/**
 * Lazy Resend singleton — avoids crashing module evaluation (build-time)
 * when the key isn't present yet; fails closed on first real use.
 */
export function getResend(): Resend {
  if (!client) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error(
        "RESEND_API_KEY is not defined. Add it to your environment variables.",
      );
    }
    client = new Resend(key);
  }
  return client;
}
