"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";

export type AdminNavLink = { href: string; label: string; badge?: number };

/** Sub-navigation inside /admin. The app's own nav stays above it. */
export function AdminNav({ links }: { links: readonly AdminNavLink[] }) {
  const pathname = usePathname();

  // /admin itself is only active on an exact match; the others also cover their children.
  const isActive = (href: string) =>
    href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav aria-label="Админ хэсгүүд" className="border-b">
      <ul className="-mb-px flex flex-wrap gap-1">
        {links.map((link) => {
          const active = isActive(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {link.label}
                {link.badge !== undefined && link.badge > 0 && (
                  <Badge variant="secondary" className="tabular-nums">
                    {link.badge}
                  </Badge>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
