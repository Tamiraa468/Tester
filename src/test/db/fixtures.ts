// Test data for the database suite. Everything a test creates goes through a
// TestScope, and scope.cleanup() removes it again (the suite fails if anything is left).
import { db } from "@/lib/db";
import { setClockForTests } from "@/lib/clock";
import { signInAs } from "./session";

let sequence = 0;
const uniqueTag = () =>
  `t${process.pid.toString(36)}${Date.now().toString(36)}${(sequence++).toString(36)}`;

export type QuestionSpec = {
  /** Default 4 options with the second one correct. */
  options?: number;
  /** Adds a pinned, correct "Бүгд зөв" as the last option. */
  pinnedLast?: boolean;
  lockOptions?: boolean;
  isActive?: boolean;
};

export type TestSubject = { id: string; name: string; questionIds: string[] };

export class TestScope {
  private clerkIds: string[] = [];
  private presetIds: string[] = [];
  private questionIds: string[] = [];
  private subjectIds: string[] = [];
  private clockSet = false;

  /** A Clerk user id; the DB user is created on first use (or now, with `create`). */
  async user(label: string, { create = false } = {}): Promise<{ clerkId: string; id?: string }> {
    const clerkId = `test-${label}-${uniqueTag()}`;
    this.clerkIds.push(clerkId);
    if (!create) return { clerkId };
    const user = await db.user.create({ data: { clerkId } });
    return { clerkId, id: user.id };
  }

  async userId(clerkId: string): Promise<string> {
    return (await db.user.findUniqueOrThrow({ where: { clerkId } })).id;
  }

  async subject(questions: QuestionSpec[] | number, name?: string): Promise<TestSubject> {
    const tag = uniqueTag();
    const subject = await db.subject.create({
      data: { name: name ? `${name} ${tag}` : `Хичээл ${tag}`, slug: tag },
    });
    this.subjectIds.push(subject.id);

    const specs: QuestionSpec[] =
      typeof questions === "number" ? Array.from({ length: questions }, () => ({})) : questions;
    const questionIds: string[] = [];
    for (const [index, spec] of specs.entries()) {
      const optionCount = spec.options ?? 4;
      const options = Array.from({ length: optionCount }, (_, sortOrder) => ({
        text: `Хариулт ${sortOrder + 1}`,
        isCorrect: !spec.pinnedLast && sortOrder === 1,
        pinned: false,
        sortOrder,
      }));
      if (spec.pinnedLast) {
        options.push({ text: "Бүгд зөв", isCorrect: true, pinned: true, sortOrder: optionCount });
      }
      const question = await db.question.create({
        data: {
          code: `${tag}-${index}`,
          subjectId: subject.id,
          text: `Асуулт ${tag}-${index}`,
          explanation: `Тайлбар ${tag}-${index}`,
          lockOptions: spec.lockOptions ?? false,
          isActive: spec.isActive ?? true,
          options: { create: options },
        },
      });
      this.questionIds.push(question.id);
      questionIds.push(question.id);
    }
    return { id: subject.id, name: subject.name, questionIds };
  }

  /**
   * Registers a question a test created through a server action, so cleanup() removes
   * it (and, before its subject, satisfies the foreign key).
   */
  trackQuestion(questionId: string): string {
    this.questionIds.push(questionId);
    return questionId;
  }

  async preset(data: {
    questionCount: number;
    timeLimitMin: number;
    distribution?: Record<string, number>;
    isActive?: boolean;
  }): Promise<string> {
    const preset = await db.examPreset.create({
      data: { name: `Шалгалт ${uniqueTag()}`, ...data },
    });
    this.presetIds.push(preset.id);
    return preset.id;
  }

  /** Freezes the app clock at `at`; returns a setter to move it. */
  freezeClock(at: Date): (next: Date) => void {
    let current = at;
    setClockForTests(() => new Date(current.getTime()));
    this.clockSet = true;
    return (next) => {
      current = next;
    };
  }

  async cleanup(): Promise<void> {
    if (this.clockSet) setClockForTests(null);
    signInAs(null);
    // Users first: their attempts, items, progress, bookmarks and reports cascade.
    await db.user.deleteMany({ where: { clerkId: { in: this.clerkIds } } });
    await db.examPreset.deleteMany({ where: { id: { in: this.presetIds } } });
    await db.question.deleteMany({ where: { id: { in: this.questionIds } } });
    await db.subject.deleteMany({ where: { id: { in: this.subjectIds } } });
    this.clerkIds = [];
    this.presetIds = [];
    this.questionIds = [];
    this.subjectIds = [];
  }
}

export async function correctOptionId(questionId: string): Promise<string> {
  return (await db.option.findFirstOrThrow({ where: { questionId, isCorrect: true } })).id;
}
