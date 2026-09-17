import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { DownloadIcon } from "lucide-react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { ImportPanel } from "@/components/admin/import-panel";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Импорт" };

export default async function AdminImportPage() {
  await auth.protect();
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Импорт</h1>
          <p className="text-sm text-muted-foreground">
            Асуултын санг .xlsx / .csv файлаас нэмэх, шинэчлэх. Эхлээд шалгаад, дараа нь
            импортлоно.
          </p>
        </div>
        <a
          href="/api/admin/template"
          className={cn(buttonVariants({ variant: "outline" }), "h-9")}
          download
        >
          <DownloadIcon aria-hidden="true" />
          Загвар татах
        </a>
      </div>

      <ImportPanel />
    </div>
  );
}
