"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon, MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AttemptHeader } from "@/components/quiz/attempt-header";
import { QuestionCard } from "@/components/quiz/question-card";
import { QuestionNavigator, type NavigatorItem } from "@/components/quiz/question-navigator";
import { DEMO_QUESTIONS, EXAM_QUESTIONS } from "./fixtures";

// The showcase's own chrome (section titles, dev controls) is in English: it is a
// developer surface. Everything inside the components is the real Mongolian copy.

function Section({
  title,
  note,
  action,
  children,
}: {
  title: string;
  note?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-t pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
          {title}
        </h2>
        {action}
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      {children}
    </section>
  );
}

/**
 * Flips the `dark` class on <html> directly. The app has no theme provider yet, and
 * this page only has to make both themes reachable for a look. Nothing else touches
 * the class, so the page always starts light.
 */
function ThemeToggle() {
  const [dark, setDark] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-pressed={dark}
      onClick={() => {
        const next = !dark;
        document.documentElement.classList.toggle("dark", next);
        setDark(next);
      }}
    >
      {dark ? <SunIcon aria-hidden="true" /> : <MoonIcon aria-hidden="true" />}
      {dark ? "Light" : "Dark"}
    </Button>
  );
}

function ViewportWidth() {
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <span className="font-mono text-xs text-muted-foreground tabular-nums">
      {width === null ? "…" : `${width}px`}
    </span>
  );
}

/** Practice: choosing an option answers the question and reveals the result at once. */
function PracticeUnanswered() {
  const question = DEMO_QUESTIONS.hypothesis;
  const [selected, setSelected] = useState<string | null>(null);
  const [bookmarked, setBookmarked] = useState(false);

  return (
    <Section
      title="Practice — unanswered"
      note="Choosing submits the answer, which is why arrow keys only move focus."
      action={
        <Button type="button" variant="ghost" size="xs" onClick={() => setSelected(null)}>
          Reset
        </Button>
      }
    >
      <QuestionCard
        mode="practice"
        position={3}
        total={20}
        subject={question.subject}
        text={question.text}
        options={question.options}
        selectedOptionId={selected}
        correctOptionId={selected === null ? null : question.correctOptionId}
        explanation={question.explanation}
        onChoose={setSelected}
        bookmarked={bookmarked}
        onToggleBookmark={() => setBookmarked((value) => !value)}
      />
    </Section>
  );
}

function PracticeAnswered({
  title,
  questionKey,
  answerCorrectly,
  initiallyBookmarked,
}: {
  title: string;
  questionKey: keyof typeof DEMO_QUESTIONS;
  answerCorrectly: boolean;
  initiallyBookmarked: boolean;
}) {
  const question = DEMO_QUESTIONS[questionKey];
  const [bookmarked, setBookmarked] = useState(initiallyBookmarked);
  const wrongOption = question.options.find((option) => option.id !== question.correctOptionId)!;

  return (
    <Section title={title}>
      <QuestionCard
        mode="practice"
        position={4}
        total={20}
        subject={question.subject}
        text={question.text}
        options={question.options}
        selectedOptionId={answerCorrectly ? question.correctOptionId : wrongOption.id}
        correctOptionId={question.correctOptionId}
        explanation={question.explanation}
        bookmarked={bookmarked}
        onToggleBookmark={() => setBookmarked((value) => !value)}
      />
    </Section>
  );
}

/** Exam: answers stay editable until the attempt is submitted, and F flags a question. */
function ExamRunner() {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({
    [EXAM_QUESTIONS[1].id]: true,
  });
  const [submitted, setSubmitted] = useState(false);

  const question = EXAM_QUESTIONS[index];
  const answeredCount = Object.keys(answers).length;

  const items: NavigatorItem[] = EXAM_QUESTIONS.map((item, position) => ({
    position: position + 1,
    answered: answers[item.id] !== undefined,
    flagged: flagged[item.id] === true,
  }));

  const reset = () => {
    setIndex(0);
    setAnswers({});
    setFlagged({ [EXAM_QUESTIONS[1].id]: true });
    setSubmitted(false);
  };

  return (
    <Section
      title="Exam — runner"
      note="Flag with F or the button; digits 1–6 choose; submitting reveals the answers."
      action={
        <Button type="button" variant="ghost" size="xs" onClick={reset}>
          Reset
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <AttemptHeader
          position={index + 1}
          total={EXAM_QUESTIONS.length}
          answeredCount={answeredCount}
          remainingSeconds={submitted ? 0 : 754}
        />

        <QuestionCard
          mode="exam"
          position={index + 1}
          total={EXAM_QUESTIONS.length}
          subject={question.subject}
          text={question.text}
          options={question.options}
          selectedOptionId={answers[question.id] ?? null}
          correctOptionId={submitted ? question.correctOptionId : null}
          explanation={submitted ? question.explanation : null}
          onChoose={(optionId) =>
            setAnswers((current) => ({ ...current, [question.id]: optionId }))
          }
          flagged={flagged[question.id] === true}
          onToggleFlag={() =>
            setFlagged((current) => ({ ...current, [question.id]: !current[question.id] }))
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={index === 0}
            onClick={() => setIndex((value) => Math.max(value - 1, 0))}
          >
            <ChevronLeftIcon aria-hidden="true" />
            Өмнөх
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={index === EXAM_QUESTIONS.length - 1}
            onClick={() => setIndex((value) => Math.min(value + 1, EXAM_QUESTIONS.length - 1))}
          >
            Дараах
            <ChevronRightIcon aria-hidden="true" />
          </Button>
          <Button
            type="button"
            className="ml-auto"
            disabled={submitted}
            onClick={() => setSubmitted(true)}
          >
            Шалгалт дуусгах
          </Button>
        </div>

        <QuestionNavigator
          items={items}
          currentPosition={index + 1}
          onJump={(position) => setIndex(position - 1)}
        />
      </div>
    </Section>
  );
}

/** Deterministic states — nothing in this page may call Math.random. */
const LONG_NAVIGATOR: NavigatorItem[] = Array.from({ length: 40 }, (_, cell) => {
  const position = cell + 1;
  return {
    position,
    answered: position <= 14 && position % 4 !== 0,
    flagged: position % 7 === 0,
  };
});

function NavigatorDemo() {
  const [current, setCurrent] = useState(11);

  return (
    <Section title="Exam navigator — 40 questions" note="Wraps to the viewport width.">
      <QuestionNavigator
        items={LONG_NAVIGATOR}
        currentPosition={current}
        onJump={setCurrent}
      />
    </Section>
  );
}

function HeaderStates() {
  return (
    <Section title="Attempt header — normal and under a minute">
      <div className="flex flex-col gap-6">
        <AttemptHeader position={7} total={40} answeredCount={6} remainingSeconds={3752} />
        <AttemptHeader position={39} total={40} answeredCount={38} remainingSeconds={41} />
        <AttemptHeader position={3} total={20} answeredCount={2} />
      </div>
    </Section>
  );
}

const SPECIMEN_SENTENCE = "Шинжлэх ухааны үндэслэлтэй, өөр хоорондоо уялдаатай дүгнэлт.";

function Specimen({
  name,
  className,
}: {
  name: string;
  className: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <p className="font-mono text-xs text-muted-foreground">{name}</p>
      <p className={`${className} text-5xl leading-tight`}>Өө Үү</p>
      <p className={`${className} text-base leading-relaxed`}>{SPECIMEN_SENTENCE}</p>
      <p className={`${className} text-sm tabular-nums`}>a b c d e f · 0123456789</p>
    </div>
  );
}

function TypeSpecimen() {
  return (
    <Section
      title="Type specimen"
      note="Literata sets question and explanation text; Inter sets the interface."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Specimen name="Literata 400" className="font-serif" />
        <Specimen name="Literata 700" className="font-serif font-bold" />
        <Specimen name="Inter 400" className="font-sans" />
        <Specimen name="Inter 700" className="font-sans font-bold" />
      </div>
    </Section>
  );
}

export function UiShowcase() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold">Quiz UI showcase</h1>
          <p className="text-xs text-muted-foreground">
            Dev only · fixture data · no database
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ViewportWidth />
          <ThemeToggle />
        </div>
      </header>

      <PracticeUnanswered />
      <PracticeAnswered
        title="Practice — answered correctly"
        questionKey="standardError"
        answerCorrectly
        initiallyBookmarked={false}
      />
      <PracticeAnswered
        title="Practice — answered wrong"
        questionKey="qualitative"
        answerCorrectly={false}
        initiallyBookmarked
      />
      <Section
        title="Practice — long stem, six options"
        note="Density check at 360px, including a pinned last option."
      >
        <QuestionCard
          mode="practice"
          position={12}
          total={20}
          subject={DEMO_QUESTIONS.consent.subject}
          text={DEMO_QUESTIONS.consent.text}
          options={DEMO_QUESTIONS.consent.options}
          selectedOptionId={null}
          bookmarked={false}
        />
      </Section>
      <HeaderStates />
      <ExamRunner />
      <NavigatorDemo />
      <TypeSpecimen />
    </div>
  );
}
