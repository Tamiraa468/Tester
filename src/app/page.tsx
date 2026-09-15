import Link from "next/link";
import { Show } from "@clerk/nextjs";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16 text-center">
      <div className="flex max-w-xl flex-col gap-4">
        <h1 className="text-3xl font-bold sm:text-4xl">Докторын тест</h1>
        <p className="text-lg text-muted-foreground">
          Докторантурын элсэлтийн шалгалтын сонгох хариулттай тестийн бүх
          асуултаар дадлага хийж, шалгалтын горимоор өөрийгөө сорьж, алдсан
          асуултаа давтан бататгаарай.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Show when="signed-out">
          <Link href="/sign-in" className={buttonVariants({ size: "lg" })}>
            Нэвтрэх
          </Link>
          <Link
            href="/sign-up"
            className={buttonVariants({ size: "lg", variant: "outline" })}
          >
            Бүртгүүлэх
          </Link>
        </Show>
        <Show when="signed-in">
          <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
            Хяналтын самбар руу орох
          </Link>
        </Show>
      </div>
    </main>
  );
}
