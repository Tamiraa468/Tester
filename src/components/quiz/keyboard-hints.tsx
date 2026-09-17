import type { ReactNode } from "react";

function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border bg-muted px-1.5 py-0.5 font-sans text-[0.7rem] font-medium text-foreground">
      {children}
    </kbd>
  );
}

/**
 * The keyboard contract, spelled out for the user. Arrow keys are listed as moving
 * focus, not as choosing, because that is what they do.
 */
export function KeyboardHints({ showFlag = false }: { showFlag?: boolean }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        <Key>↑</Key>
        <Key>↓</Key>
        сонголт хооронд шилжих
      </span>
      <span className="flex items-center gap-1">
        <Key>Enter</Key>
        <Key>Space</Key>
        сонгох
      </span>
      <span className="flex items-center gap-1">
        <Key>1</Key>–<Key>6</Key>
        шууд сонгох
      </span>
      {showFlag && (
        <span className="flex items-center gap-1">
          <Key>F</Key>
          эргэж харах
        </span>
      )}
    </p>
  );
}
