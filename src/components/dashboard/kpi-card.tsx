import { Card, CardContent } from "@/components/ui/card";

/** One headline figure. `hint` explains what the number is measured against. */
export function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="text-xs text-muted-foreground tabular-nums">{hint}</p>}
      </CardContent>
    </Card>
  );
}

/** "78%", or "—" when nothing has been answered yet. */
export function formatPercent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}
