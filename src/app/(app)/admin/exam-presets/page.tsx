import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { PresetManager } from "@/components/admin/preset-manager";
import { requireAdmin } from "@/lib/auth";
import { listAdminPresets } from "@/server/queries/admin/presets";

export const metadata: Metadata = { title: "Шалгалтын төрөл" };

export default async function AdminPresetsPage() {
  await auth.protect();
  await requireAdmin();

  const { presets, bank } = await listAdminPresets();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Шалгалтын төрөл</h1>
        <p className="text-sm text-muted-foreground">
          Асуултын тоо, хугацаа, судлагдахууны хуваарилалт. Хуваарилалтыг идэвхтэй асуултын
          тоотой тулгаж шалгана.
        </p>
      </div>

      <PresetManager presets={presets} bank={bank} />
    </div>
  );
}
