// Per-subject result table. The total row is computed from the same items, so the
// subject rows always add up to it.

export type ResultItem = {
  subjectName: string;
  answered: boolean;
  isCorrect: boolean;
};

export type ResultRow = {
  subject: string;
  correct: number;
  answered: number;
  total: number;
  percent: number;
};

const percentOf = (correct: number, total: number) =>
  total === 0 ? 0 : Math.round((correct / total) * 100);

export function subjectBreakdown(items: readonly ResultItem[]): {
  rows: ResultRow[];
  total: ResultRow;
} {
  const bySubject = new Map<string, { correct: number; answered: number; total: number }>();
  for (const item of items) {
    const row = bySubject.get(item.subjectName) ?? { correct: 0, answered: 0, total: 0 };
    row.total += 1;
    if (item.answered) row.answered += 1;
    if (item.isCorrect) row.correct += 1;
    bySubject.set(item.subjectName, row);
  }

  const rows = [...bySubject.entries()]
    .map(([subject, row]) => ({ subject, ...row, percent: percentOf(row.correct, row.total) }))
    .sort((a, b) => a.subject.localeCompare(b.subject, "mn"));
  const sum = (key: "correct" | "answered" | "total") =>
    rows.reduce((acc, row) => acc + row[key], 0);
  const correct = sum("correct");
  const total = sum("total");

  return {
    rows,
    total: { subject: "Нийт", correct, answered: sum("answered"), total, percent: percentOf(correct, total) },
  };
}
