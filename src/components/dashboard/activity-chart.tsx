"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { ActivityRow } from "@/lib/activity";
import { dayOfMonth, formatDayLong } from "@/lib/date";

// One series, one hue: --chart-1 is the indigo the tokens define per theme, so the
// bars never pick up the default multi-colour set.
const chartConfig = {
  total: { label: "Хариулт", color: "var(--chart-1)" },
} satisfies ChartConfig;

/**
 * Graded answers per day over the last 30 days. A single series needs no legend — the
 * heading names it — and `summary` states the same figures in words for anyone who
 * cannot read the bars; the full day-by-day numbers follow in a screen-reader table.
 */
export function ActivityChart({
  days,
  summary,
}: {
  days: readonly ActivityRow[];
  summary: string;
}) {
  return (
    <figure className="flex flex-col gap-2">
      <ChartContainer config={chartConfig} className="aspect-auto h-48 w-full">
        <BarChart accessibilityLayer data={[...days]} margin={{ left: 0, right: 0, top: 4 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={16}
            tickFormatter={(day: string) => String(dayOfMonth(day))}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(_label, payload) =>
                  formatDayLong(String(payload?.[0]?.payload?.day ?? ""))
                }
                formatter={(value, _name, item) => (
                  <span className="tabular-nums">
                    {Number(value)} хариулт · {Number(item?.payload?.correct ?? 0)} зөв
                  </span>
                )}
              />
            }
          />
          <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>

      <figcaption className="text-sm text-muted-foreground">{summary}</figcaption>

      <table className="sr-only">
        <caption>Сүүлийн 30 хоногийн хариултууд</caption>
        <thead>
          <tr>
            <th scope="col">Өдөр</th>
            <th scope="col">Нийт хариулт</th>
            <th scope="col">Зөв</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.day}>
              <th scope="row">{formatDayLong(day.day)}</th>
              <td>{day.total}</td>
              <td>{day.correct}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
