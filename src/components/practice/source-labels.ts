import type { AttemptSource } from "@/generated/prisma/enums";
import { mn, vocab } from "@/lib/i18n/mn";

/** Wording comes from the vocabulary so a source is named the same everywhere. */
export const SOURCE_LABELS: Record<AttemptSource, { label: string; description: string }> = {
  NEW: { label: "Шинэ асуултууд", description: "Та хараахан хариулж үзээгүй асуултууд" },
  WRONG: {
    label: `${vocab.wrong} асуултууд`,
    description: "Буруу хариулж байсан, бүрэн эзэмшээгүй асуултууд",
  },
  DUE: {
    label: `${vocab.review} хугацаа болсон`,
    description: "Давтлагын хуваарийн дагуу одоо давтах асуултууд",
  },
  RANDOM: { label: "Санамсаргүй", description: "Бүх идэвхтэй асуултаас санамсаргүйгээр" },
  BOOKMARKED: { label: vocab.bookmarked, description: "Таны тэмдэглэсэн асуултууд" },
  CUSTOM: { label: mn.actions.retryWrong, description: "Өмнөх дадлагад алдсан асуултууд" },
};
