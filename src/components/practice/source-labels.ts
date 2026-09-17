import type { AttemptSource } from "@/generated/prisma/enums";

export const SOURCE_LABELS: Record<AttemptSource, { label: string; description: string }> = {
  NEW: { label: "Шинэ асуултууд", description: "Та хараахан хариулж үзээгүй асуултууд" },
  WRONG: {
    label: "Алдсан асуултууд",
    description: "Буруу хариулж байсан, бүрэн эзэмшээгүй асуултууд",
  },
  DUE: {
    label: "Давтах хугацаа болсон",
    description: "Давтлагын хуваарийн дагуу одоо давтах асуултууд",
  },
  RANDOM: { label: "Санамсаргүй", description: "Бүх идэвхтэй асуултаас санамсаргүйгээр" },
  BOOKMARKED: { label: "Тэмдэглэсэн", description: "Таны тэмдэглэсэн асуултууд" },
  CUSTOM: { label: "Алдсанаа давтах", description: "Өмнөх дадлагад алдсан асуултууд" },
};
