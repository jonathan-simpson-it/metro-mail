import { site } from "@/lib/site";
import Image from "next/image";

export function AuthShell({
  children,
  title,
  eyebrow = "Internal Communications",
  description,
}: {
  children: React.ReactNode;
  title: string;
  eyebrow?: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="mb-10 flex flex-col items-center text-center">
        <div className="mb-6 grid h-16 w-16 place-items-center border border-line bg-paper">
          <Image
            src={site.brandLogoInk}
            alt="Jonathan Simpson & Co. logo"
            width={40}
            height={40}
            priority
          />
        </div>
        <p className="eyebrow mb-3">{eyebrow}</p>
        <h1 className="font-serif text-4xl tracking-[-0.01em] text-ink md:text-5xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
            {description}
          </p>
        ) : null}
      </header>

      <main id="main" className="w-full max-w-md panel p-6 md:p-8">{children}</main>

      <footer className="mt-10 flex flex-col items-center gap-2 text-center">
        <a
          href={site.website}
          className="text-xs tracking-[0.08em] text-muted underline-offset-4 hover:text-sage-text-text"
        >
          jonathansimpson.co
        </a>
        <p className="text-xs text-muted">
          © {new Date().getFullYear()} {site.name} All rights reserved.
        </p>
      </footer>
    </div>
  );
}
