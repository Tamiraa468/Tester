import type { ReactNode } from "react";
import { KeyboardIcon } from "lucide-react";

export function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border bg-muted px-1.5 py-0.5 font-sans text-[0.7rem] font-medium text-foreground">
      {children}
    </kbd>
  );
}

/**
 * The keyboard contract, spelled out for the user. Arrow keys are listed as moving
 * focus, not as choosing, because that is what they do. Hidden on touch-first small
 * screens, where it is noise; the help dialog is still one key or tap away.
 */
export function KeyboardHints({
  mode = "practice",
  onShowHelp,
}: {
  mode?: "practice" | "exam";
  onShowHelp?: () => void;
}) {
  return (
    <div className="hidden flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground sm:flex">
      <span className="flex items-center gap-1">
        <Key>1</Key>–<Key>6</Key>
        хариулт сонгох
      </span>
      <span className="flex items-center gap-1">
        <Key>↑</Key>
        <Key>↓</Key>
        шилжих
      </span>
      <span className="flex items-center gap-1">
        <Key>Enter</Key>
        сонгох
      </span>
      {mode === "exam" && (
        <>
          <span className="flex items-center gap-1">
            <Key>N</Key>
            <Key>P</Key>
            дараах / өмнөх
          </span>
          <span className="flex items-center gap-1">
            <Key>F</Key>
            эргэж харах
          </span>
        </>
      )}
      {onShowHelp && (
        <button
          type="button"
          onClick={onShowHelp}
          className="flex items-center gap-1 rounded underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <KeyboardIcon className="size-3.5" aria-hidden="true" />
          <Key>?</Key>
          бүх товчлол
        </button>
      )}
    </div>
  );
}
