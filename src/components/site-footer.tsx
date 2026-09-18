import Link from "next/link";
import { mn } from "@/lib/i18n/mn";

const FOOTER_LINKS = [
  { href: "/practice", label: mn.nav.practice },
  { href: "/exam", label: mn.nav.exam },
  { href: "/review", label: mn.nav.review },
  { href: "/dashboard", label: mn.nav.dashboard },
];

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex max-w-sm flex-col gap-2">
          <p className="font-semibold">{mn.app.name}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Докторантурын элсэлтийн шалгалтын сонгох хариулттай тестийн бэлтгэл. Асуултын
            сангийн эх сурвалж нь хэвлэмэл эмхэтгэл бөгөөд хувийн бэлтгэлд зориулагдсан.
          </p>
        </div>
        <nav aria-label="Хуудсууд">
          <ul className="flex flex-col gap-1">
            {FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="flex min-h-11 items-center rounded-md text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline sm:min-h-8"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
