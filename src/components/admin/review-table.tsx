import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { QuestionNeedingReview } from "@/server/queries/admin/overview";

/**
 * Questions most users got wrong the first time they met them. The most-chosen wrong
 * option is shown next to the current correct one: when a plausible wrong option is
 * winning by a wide margin, the answer key is the first thing to check.
 */
export function ReviewTable({ rows }: { rows: readonly QuestionNeedingReview[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Хангалттай хэрэглэгч хариулсан, эргэлзээтэй асуулт одоогоор алга.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Асуулт</TableHead>
          <TableHead className="text-right">Алдсан</TableHead>
          <TableHead>Хамгийн их сонгосон буруу хувилбар</TableHead>
          <TableHead>Одоогийн зөв хариулт</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="max-w-sm align-top">
              <Link
                href={`/admin/questions/${row.id}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                <span className="font-mono text-xs text-muted-foreground">{row.code}</span>
                <span className="mt-0.5 line-clamp-2 block font-serif font-normal">{row.text}</span>
              </Link>
              <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {row.subjectName}
                {!row.isActive && <Badge variant="outline">Идэвхгүй</Badge>}
              </span>
            </TableCell>
            <TableCell className="text-right align-top tabular-nums">
              <span className="font-semibold">{Math.round(row.wrongRate * 100)}%</span>
              <span className="block text-xs text-muted-foreground">
                {row.wrong}/{row.users} хэрэглэгч
              </span>
            </TableCell>
            <TableCell className="max-w-xs align-top font-serif text-sm">
              {row.topWrongText ?? "—"}
              {row.topWrongPicks !== null && (
                <span className="block font-sans text-xs text-muted-foreground tabular-nums">
                  {row.topWrongPicks} хэрэглэгч сонгосон
                </span>
              )}
            </TableCell>
            <TableCell className="max-w-xs align-top font-serif text-sm">
              {row.correctText ?? "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
