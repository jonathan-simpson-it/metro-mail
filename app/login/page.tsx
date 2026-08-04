import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

/**
 * Real session check — redirects to the dashboard only when the session is
 * actually valid. A stale cookie renders the form instead of looping.
 */
export default async function LoginPage() {
  const session = await (await getAuth()).api.getSession({ headers: await headers() });
  if (session) redirect("/dashboard");

  return (
    <AuthShell
      title="Sign in"
      eyebrow="Partner Access"
      description="Welcome back. Sign in to manage inbound routing and outbound correspondence."
    >
      <LoginForm />
    </AuthShell>
  );
}
