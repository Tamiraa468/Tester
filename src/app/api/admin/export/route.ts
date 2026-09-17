import { PassThrough, Readable } from "node:stream";
import { auth } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/auth";
import { now } from "@/lib/clock";
import { exportFileName } from "@/lib/import/export";
import { streamQuestionsWorkbook } from "@/lib/import/export-stream";
import { iterateQuestionsForExport } from "@/server/queries/admin/export";

export const dynamic = "force-dynamic";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * The whole bank as .xlsx in the template's shape, so export -> import is a round trip.
 * The workbook is streamed: rows are fetched a page at a time and written straight to
 * the response, so the size of the bank does not decide the memory this takes.
 */
export async function GET(): Promise<Response> {
  await auth.protect();
  await requireAdmin();

  const passthrough = new PassThrough();
  // Kicked off without awaiting: the response body is the other end of this stream.
  void streamQuestionsWorkbook(passthrough, iterateQuestionsForExport()).catch(
    (error: unknown) => {
      // Destroying the stream aborts the download instead of serving a truncated file.
      passthrough.destroy(error instanceof Error ? error : new Error(String(error)));
    },
  );

  return new Response(Readable.toWeb(passthrough) as ReadableStream<Uint8Array>, {
    headers: {
      "Content-Type": XLSX_TYPE,
      "Content-Disposition": `attachment; filename="${exportFileName(now())}"`,
      "Cache-Control": "no-store",
    },
  });
}
