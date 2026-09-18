"use client";

import { useTheme } from "next-themes";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { mn } from "@/lib/i18n/mn";

const OPTIONS = [
  { value: "light", label: mn.theme.light, Icon: SunIcon },
  { value: "dark", label: mn.theme.dark, Icon: MoonIcon },
  { value: "system", label: mn.theme.system, Icon: MonitorIcon },
] as const;

/**
 * Icon-only control, so it carries its name in aria-label. The two icons are both in
 * the markup and swapped with the `dark:` variant rather than with `resolvedTheme`:
 * the server has no way to know the theme, so choosing the icon in JavaScript would
 * either mismatch on hydration or make the button pop in a frame late.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={mn.theme.toggle}
            className="size-11 sm:size-8"
          />
        }
      >
        <SunIcon className="dark:hidden" aria-hidden="true" />
        <MoonIcon className="hidden dark:block" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 min-w-48">
        <DropdownMenuRadioGroup
          // The menu only mounts once opened, by which time next-themes has read the
          // stored preference — so this never renders with an undefined value on the
          // server and never disagrees with the client on hydration.
          value={theme}
          onValueChange={(value) => setTheme(String(value))}
        >
          {OPTIONS.map(({ value, label, Icon }) => (
            <DropdownMenuRadioItem key={value} value={value} className="h-11 whitespace-nowrap sm:h-8">
              <Icon aria-hidden="true" />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
