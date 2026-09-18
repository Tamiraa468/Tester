import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { DownloadIcon } from "lucide-react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { vocab } from "@/lib/i18n/mn";
import { countQuestionsForExport } from "@/server/queries/admin/export";

export const metadata: Metadata = { title: "Экспорт" };

export default async function AdminExportPage() {
  await auth.protect();
  await requireAdmin();

  const total = await countQuestionsForExport();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Экспорт</h1>
        <p className="text-sm text-muted-foreground">
          Бүх асуултыг загварын форматаар татаж авах. Татсан файлаа буцааж импортловол юу ч
          өөрчлөгдөхгүй (бүх мөр «өөрчлөлтгүй» гэж тайлагнана).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{vocab.bank}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground tabular-nums">
            Нийт {total} асуулт (идэвхгүй асуултууд ч багтана). Идэвхийг «active» багана
            хадгална.
          </p>
          <div className="flex flex-wrap gap-2">
            <a href="/api/admin/export" className={cn(buttonVariants(), "h-9")} download>
              <DownloadIcon aria-hidden="true" />
              .xlsx татах
            </a>
            <a
              href="/api/admin/template"
              className={cn(buttonVariants({ variant: "outline" }), "h-9")}
              download
            >
              <DownloadIcon aria-hidden="true" />
              Хоосон загвар
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
