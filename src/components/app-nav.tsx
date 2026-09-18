"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { MenuIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { mn } from "@/lib/i18n/mn";

const links = [
  { href: "/dashboard", label: mn.nav.dashboard },
  { href: "/practice", label: mn.nav.practice },
  { href: "/exam", label: mn.nav.exam },
  { href: "/review", label: mn.nav.review },
];

const adminLink = { href: "/admin", label: mn.nav.admin };

export function AppNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = isAdmin ? [...links, adminLink] : links;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  // min-h-11 on the sheet's links: a 44px target on a phone, the desktop row stays 36px.
  const linkClass = (href: string, mobile = false) =>
    cn(
      "flex items-center rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
      mobile && "min-h-11",
      isActive(href) && "bg-muted text-foreground",
    );

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4">
        <Link href="/dashboard" className="font-semibold">
          {mn.app.name}
        </Link>

        <nav aria-label={mn.nav.menu} className="hidden items-center gap-1 md:flex">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={linkClass(item.href)}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <UserButton />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 md:hidden"
                  aria-label={mn.nav.openMenu}
                />
              }
            >
              <MenuIcon />
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>{mn.nav.menu}</SheetTitle>
              </SheetHeader>
              <nav aria-label={mn.nav.menu} className="flex flex-col gap-1 px-4">
                {items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={linkClass(item.href, true)}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
