import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { site } from "@/lib/site";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await (await getAuth()).api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const user = session.user;

  return (
    <div className="flex min-h-dvh flex-col bg-cream">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {/* Ink letterhead bar */}
      <header className="border-b border-ink bg-ink text-paper">
        <div className="mx-auto flex min-h-14 w-full max-w-[1400px] flex-wrap items-center gap-x-8 gap-y-2 px-5 py-2.5">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Image
              src={site.brandLogoInk}
              alt=""
              width={22}
              height={22}
              className="rounded-[2px] bg-paper p-0.5"
            />
            <span className="font-serif text-[0.9rem] uppercase tracking-[0.1em] text-paper">
              {site.productName}
            </span>
          </Link>

          <DashboardNav />

          <div className="ml-auto flex items-center gap-4">
            <span className="hidden font-mono text-[0.72rem] text-paper/60 md:inline">
              {user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>
    </div>
  );
}
