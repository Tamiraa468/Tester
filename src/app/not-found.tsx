import Link from "next/link";
import { FileQuestionIcon } from "lucide-react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { mn } from "@/lib/i18n/mn";

export const metadata = { title: mn.states.notFoundTitle };

export default function NotFound() {
  return (
    <main id="main" className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <FileQuestionIcon className="size-6" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted-foreground tabular-nums">404</p>
          <h1 className="text-2xl font-semibold">{mn.states.notFoundTitle}</h1>
          <p className="reading-sm text-muted-foreground">{mn.states.notFoundBody}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/" className={cn(buttonVariants({ size: "lg" }), "h-11 text-base")}>
            {mn.actions.goHome}
          </Link>
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-11 text-base")}
          >
            {mn.actions.goDashboard}
          </Link>
        </div>
      </div>
    </main>
  );
}
