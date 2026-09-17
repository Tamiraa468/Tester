import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UiShowcase } from "./showcase";

export const metadata: Metadata = { title: "Quiz UI showcase" };

/**
 * Developer-only showcase of the quiz UI, built from fixtures: no auth, no database,
 * no real questions. It must not exist in a production build.
 */
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiShowcase />;
}
