"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/lib/auth-client";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await signUp.email({ name, email, password });

    if (error) {
      setError(
        error.message === "NOT_ALLOWED"
          ? "This platform is invite-only. Your email is not on the access list."
          : error.message ?? "Unable to create account. Please try again.",
      );
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label htmlFor="name" className="field-label">
            Full name
          </label>
          <input
            id="name"
            type="text"
            required
            autoComplete="name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Lewis Simpson"
          />
        </div>
        <div>
          <label htmlFor="email" className="field-label">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@jonathansimpson.co"
          />
        </div>
        <div>
          <label htmlFor="password" className="field-label">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>

        {error ? (
          <p className="rounded-md border border-line bg-sage-soft px-3 py-2 text-xs text-ink">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn btn--solid w-full" disabled={loading}>
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-muted">
        Already have access?{" "}
        <Link
          href="/login"
          className="text-ink underline-offset-4 hover:text-sage-text hover:underline"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
