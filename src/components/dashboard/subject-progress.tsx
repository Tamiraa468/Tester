import { Progress, ProgressLabel } from "@/components/ui/progress";
import { formatPercent } from "@/components/dashboard/kpi-card";
import type { SubjectStats } from "@/server/queries/progress";

/**
 * Mastered share per subject, weakest first (the query orders them). The bar shows
 * how much of the subject is mastered; the line under it adds seen and accuracy, so
 * the colour is never the only thing carrying the number.
 */
export function SubjectProgress({ subjects }: { subjects: readonly SubjectStats[] }) {
  if (subjects.length === 0) {
    return <p className="text-sm text-muted-foreground">Одоогоор асуулт алга.</p>;
  }

  return (
    <ul className="flex flex-col gap-4">
      {subjects.map((subject) => {
        const percent = subject.total === 0 ? 0 : (subject.mastered / subject.total) * 100;
        return (
          <li key={subject.subjectId}>
            <Progress value={percent}>
              <ProgressLabel>{subject.subjectName}</ProgressLabel>
              {/* Not <ProgressValue>: it takes a render function, which a Server
                  Component cannot hand to a Client Component. */}
              <span className="ml-auto text-sm text-muted-foreground tabular-nums">
                {subject.mastered}/{subject.total} цээжилсэн
              </span>
            </Progress>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              Үзсэн {subject.seen}/{subject.total} · Нарийвчлал {formatPercent(subject.accuracy)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
