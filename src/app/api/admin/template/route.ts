import { auth } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/auth";
import { buildTemplateBuffer, TEMPLATE_FILE_NAME } from "@/lib/import/template";

export const dynamic = "force-dynamic";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * The import template, generated on request from src/lib/import/template.ts rather than
 * served from data/, so it cannot drift from the columns the pipeline reads and does not
 * depend on the file being present in a deployment.
 */
export async function GET(): Promise<Response> {
  await auth.protect();
  await requireAdmin();

  const buffer = await buildTemplateBuffer();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": XLSX_TYPE,
      "Content-Disposition": `attachment; filename="${TEMPLATE_FILE_NAME}"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
