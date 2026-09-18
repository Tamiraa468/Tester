import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import {
  ChevronDownIcon,
  LibraryBigIcon,
  ShuffleIcon,
  TrendingUpIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { mn, vocab } from "@/lib/i18n/mn";

const VALUE_POINTS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: LibraryBigIcon,
    title: `Албан ёсны ${vocab.bank.toLowerCase()}`,
    body: "Хэвлэмэл эмхэтгэлийн асуултууд судлагдахуунаараа ангилагдаж, асуулт, хариулт, тайлбар нь эх сурвалжтайгаа яг таарч орсон.",
  },
  {
    icon: ShuffleIcon,
    title: "Хариултын дараалал бүр удаа холилдоно",
    body: "Дадлага, шалгалт эхлэх бүрд хариултын дараалал сервер дээр шинээр холигдоно. Байрлалыг нь биш, агуулгыг нь сурна.",
  },
  {
    icon: TrendingUpIcon,
    title: "Ахиц дэвшил бүртгэгдэнэ",
    body: `Аль асуултыг ${vocab.mastered.toLowerCase()}, алийг нь дахин ${vocab.review.toLowerCase()} хэрэгтэйг хөтөлж, өдөр бүрийн ахицыг ${vocab.dashboard.toLowerCase()} дээр харуулна.`,
  },
];

const STEPS: { title: string; body: string }[] = [
  {
    title: vocab.practice,
    body: "Судлагдахуун, асуултын төрөл, тоогоо сонгоод эхэл. Хариултаа сонгосон даруйд зөв эсэх нь тайлбарын хамт харагдана.",
  },
  {
    title: vocab.exam,
    body: "Жинхэнэ шалгалтын нөхцөлөөр: хугацаатай, эргэж харах тэмдэгтэй, дуустал нэг ч хариу харагдахгүй.",
  },
  {
    title: vocab.review,
    body: `${vocab.wrong}, ${vocab.bookmarked.toLowerCase()} болон давтах хугацаа нь болсон асуултууд тусдаа жагсаалттай. Сайн сурсан асуулт улам сийрэг эргэж ирнэ.`,
  },
];

const FAQ: { question: string; answer: string }[] = [
  {
    question: "Асуултууд хаанаас авсан бэ?",
    answer:
      "Докторантурын элсэлтийн шалгалтын сонгох хариулттай тестийн хэвлэмэл эмхэтгэлээс. Асуулт бүр судлагдахуун, эх сурвалжийнхаа дугаартай холбоотой байдаг тул номоороо буцаж шалгах боломжтой.",
  },
  {
    question: "Хариултын дараалал үнэхээр өөрчлөгддөг үү?",
    answer:
      "Тийм. Дадлага, шалгалт үүсэх бүрд дараалал сервер дээр холигдож, тухайн оролдлогод хадгалагдана. Тиймээс «зөв хариулт нь үргэлж сүүлд байдаг» гэж цээжлэх боломжгүй.",
  },
  {
    question: "Давтах хуваарь яаж тооцогддог вэ?",
    answer:
      "Асуулт бүр зөв хариултын тоогоороо шат ахих зарчмаар: зөв хариулсан асуулт улам сийрэг, алдсан асуулт эргээд ойрхон давтагдана. Хугацаа нь болсон асуултууд «Давтах» хуудсанд цугларна.",
  },
  {
    question: "Гар утсан дээр ажиллах уу?",
    answer:
      "Ажиллана. Хариултын товчнууд эрхий хуруунд тохирсон хэмжээтэй, үйлдлийн мөр дэлгэцийн доод хэсэгт байрлана. Гар холбосон үед 1–6 тоогоор хариултаа сонгож болно.",
  },
  {
    question: "Ахиц дэвшил маань хадгалагдах уу?",
    answer:
      "Тийм. Бүх оролдлого, тэмдэглэсэн асуулт, давтлагын хуваарь таны бүртгэлд хадгалагдах тул өөр төхөөрөмжөөс нэвтрэхэд үргэлжлүүлэн ажиллана.",
  },
];

export default async function Home() {
  // Read on the server rather than with <Show>: the landing page then needs no Clerk
  // provider and loads no clerk-js. Protection is unchanged — nothing here is private.
  const { userId } = await auth();
  const signedIn = userId !== null;

  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4">
          <span className="font-semibold">{mn.app.name}</span>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            {signedIn ? (
              <Link href="/dashboard" className={cn(buttonVariants(), "h-11 px-4 sm:h-8")}>
                {mn.nav.dashboard}
              </Link>
            ) : (
              <Link
                href="/sign-in"
                className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4 sm:h-8")}
              >
                {mn.nav.signIn}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-4 py-16 text-center sm:py-24">
          <h1 className="max-w-3xl text-3xl font-semibold text-balance sm:text-5xl">
            Докторантурын элсэлтийн шалгалтад бэлдэх хамгийн шулуун зам
          </h1>
          <p className="reading measure text-muted-foreground">
            Албан ёсны асуултын сангаар дадлага хийж, шалгалтын горимоор өөрийгөө сорьж,
            алдсан асуултаа хуваарийн дагуу давтан бататгаарай.
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
            {signedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className={cn(buttonVariants({ size: "lg" }), "h-12 px-6 text-base")}
                >
                  {mn.actions.goDashboard}
                </Link>
                <Link
                  href="/practice"
                  className={cn(
                    buttonVariants({ size: "lg", variant: "outline" }),
                    "h-12 px-6 text-base",
                  )}
                >
                  {mn.actions.startPractice}
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/sign-up"
                  className={cn(buttonVariants({ size: "lg" }), "h-12 px-6 text-base")}
                >
                  Үнэгүй эхлэх
                </Link>
                <Link
                  href="/sign-in"
                  className={cn(
                    buttonVariants({ size: "lg", variant: "outline" }),
                    "h-12 px-6 text-base",
                  )}
                >
                  {mn.nav.signIn}
                </Link>
              </>
            )}
          </div>
        </section>

        <section
          aria-labelledby="value-heading"
          className="mx-auto w-full max-w-5xl px-4 pb-16 sm:pb-24"
        >
          <h2 id="value-heading" className="sr-only">
            Яагаад энэ апп гэж?
          </h2>
          <ul className="grid gap-4 sm:grid-cols-3">
            {VALUE_POINTS.map(({ icon: Icon, title, body }) => (
              <li
                key={title}
                className="flex flex-col gap-3 rounded-xl p-5 ring-1 ring-foreground/10"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="font-semibold">{title}</h3>
                <p className="reading-sm text-muted-foreground">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="how-heading"
          className="border-y bg-muted/40 py-16 sm:py-24"
        >
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4">
            <h2 id="how-heading" className="text-2xl font-semibold sm:text-3xl">
              Хэрхэн ажилладаг вэ
            </h2>
            <ol className="grid gap-6 sm:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex flex-col gap-2">
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground tabular-nums">
                    {index + 1}
                  </span>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="reading-sm text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          aria-labelledby="faq-heading"
          className="mx-auto w-full max-w-3xl px-4 py-16 sm:py-24"
        >
          <h2 id="faq-heading" className="mb-8 text-2xl font-semibold sm:text-3xl">
            Түгээмэл асуултууд
          </h2>
          {/* <details> rather than a JavaScript accordion: it is keyboard-operable and
              announced correctly with no client component and no hydration to wait for. */}
          <ul className="flex flex-col divide-y rounded-xl border">
            {FAQ.map((item) => (
              <li key={item.question}>
                <details className="group px-4">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                    {item.question}
                    <ChevronDownIcon
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </summary>
                  <p className="reading-sm pb-4 text-muted-foreground">{item.answer}</p>
                </details>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
