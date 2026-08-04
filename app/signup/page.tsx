import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const dynamic = "force-dynamic";

/**
 * Real session check. Redirects to the dashboard only when the session is
 * actually valid. A stale cookie renders the form instead of looping.
 */
export default async function SignupPage() {
  const session = await (await getAuth()).api.getSession({ headers: await headers() });
  if (session) redirect("/dashboard");

  return (
    <AuthShell
      title="Create account"
      eyebrow="Invite Only"
      description="MetroMail is an internal platform. Accounts are provisioned for authorised partners only."
    >
      <SignupForm />
    </AuthShell>
  );
}
