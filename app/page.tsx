import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { site } from "@/lib/site";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const session = await (await getAuth()).api.getSession({ headers: await headers() });
  if (session) redirect("/dashboard");

  return (
    <AuthShell
      title={site.productName}
      description="Corporate communications, engineered. Secure inbound routing, threaded conversation history, and personal, plain-text outbound delivery for Jonathan Simpson & Co."
    >
      <div className="flex flex-col gap-3">
        <Link href="/login" className="btn btn--solid w-full">
          Sign in
        </Link>
        <Link href="/signup" className="btn btn--ghost w-full">
          Create account
        </Link>
      </div>
      <div className="mt-6 border-t border-line pt-5 text-center">
        <p className="text-xs leading-relaxed text-muted">
          Internal platform. Access is restricted to authorised partner
          accounts.
        </p>
      </div>
    </AuthShell>
  );
}
