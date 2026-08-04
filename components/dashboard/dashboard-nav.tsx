"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Inbox" },
  { href: "/dashboard/campaign", label: "Campaign" },
  { href: "/dashboard/compose", label: "Compose" },
  { href: "/dashboard/deliverability", label: "Deliverability" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex items-center gap-6 text-[0.72rem] uppercase tracking-[0.1em]"
      aria-label="Dashboard"
    >
      {NAV.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`transition-colors duration-[220ms] ${
              active ? "text-paper" : "text-paper/70 hover:text-paper"
            }`}
          >
            {active ? <span className="underline decoration-sage underline-offset-8">{item.label}</span> : item.label}
          </Link>
        );
      })}
    </nav>
  );
}
