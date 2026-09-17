import { describe, expect, it } from "vitest";
import { toExamPlayerProps } from "./exam-player";
import { toPlayerItem, type RawPlayerItem } from "./player-item";

const STARTED = new Date("2026-09-17T02:00:00.000Z");
const NOW = new Date("2026-09-17T02:10:00.000Z");

const raw = (position: number, selectedOptionId: string | null, flagged = false): RawPlayerItem => ({
  id: `item${position}`,
  position,
  optionOrder: ["o2", "o1"],
  selectedOptionId,
  isCorrect: null,
  flagged,
  question: {
    id: `q${position}`,
    text: `Асуулт ${position}`,
    imageUrl: null,
    explanation: "Нууц тайлбар",
    subject: { name: "Статистик" },
    options: [
      { id: "o1", text: "Нэг", isCorrect: true },
      { id: "o2", text: "Хоёр", isCorrect: false },
    ],
  },
});

const running = (items: RawPlayerItem[]) => ({
  id: "a1",
  status: "IN_PROGRESS" as const,
  presetName: "Туршилт",
  startedAt: STARTED,
  timeLimitSec: 900,
  items: items.map((item) =>
    toPlayerItem(item, { mode: "EXAM", status: "IN_PROGRESS", bookmarked: false }),
  ),
});

describe("toExamPlayerProps", () => {
  const attempt = running([raw(0, "o1"), raw(1, null, true), raw(2, "o2", true)]);

  it("sends the current item, the navigator states and the times", () => {
    const props = toExamPlayerProps(attempt, 1, NOW);
    expect(props.item.position).toBe(2);
    expect(props.item.options).toEqual([
      { id: "o2", text: "Хоёр" },
      { id: "o1", text: "Нэг" },
    ]);
    expect(props.states).toEqual([
      { position: 1, answered: true, flagged: false },
      { position: 2, answered: false, flagged: true },
      { position: 3, answered: true, flagged: true },
    ]);
    expect(props).toEqual(
      expect.objectContaining({
        attemptId: "a1",
        total: 3,
        isFirst: false,
        isLast: false,
        deadline: "2026-09-17T02:15:00.000Z",
        serverNow: "2026-09-17T02:10:00.000Z",
      }),
    );
  });

  it("never contains correctness data or other items' content, answered or not", () => {
    for (const index of [0, 1, 2]) {
      const json = JSON.stringify(toExamPlayerProps(attempt, index, NOW));
      expect(json).not.toMatch(/isCorrect|correctOptionId|explanation|result|Нууц/);
      for (const other of [0, 1, 2].filter((n) => n !== index)) {
        expect(json).not.toContain(`Асуулт ${other}`);
      }
    }
  });

  it("marks the first and last item", () => {
    expect(toExamPlayerProps(attempt, 0, NOW)).toEqual(expect.objectContaining({ isFirst: true, isLast: false }));
    expect(toExamPlayerProps(attempt, 2, NOW)).toEqual(expect.objectContaining({ isFirst: false, isLast: true }));
  });

  it("has no deadline without a time limit", () => {
    expect(toExamPlayerProps({ ...attempt, timeLimitSec: null }, 0, NOW).deadline).toBeNull();
  });

  it("refuses to serve a finished exam, a bad index or a revealed item", () => {
    expect(() => toExamPlayerProps({ ...attempt, status: "SUBMITTED" }, 0, NOW)).toThrow();
    expect(() => toExamPlayerProps(attempt, 3, NOW)).toThrow();
    const leaked = {
      ...attempt,
      items: [{ ...attempt.items[0], result: { isCorrect: true, correctOptionId: "o1", explanation: null } }],
    };
    expect(() => toExamPlayerProps(leaked, 0, NOW)).toThrow();
  });
});
