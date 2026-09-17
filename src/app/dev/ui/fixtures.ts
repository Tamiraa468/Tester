import type { AnswerOption } from "@/components/quiz/option-list";
import type { ActivityRow } from "@/lib/activity";
import type { SubjectStats } from "@/server/queries/progress";
import { dayKeysBack } from "@/lib/date";

export type DemoQuestion = {
  id: string;
  subject: string;
  text: string;
  /**
   * Fixed display order. In the real app this order comes from the server
   * (AttemptItem.optionOrder); nothing is shuffled in the browser.
   */
  options: AnswerOption[];
  correctOptionId: string;
  explanation?: string;
};

export const DEMO_QUESTIONS: Record<string, DemoQuestion> = {
  hypothesis: {
    id: "q-hypothesis",
    subject: "Судалгааны арга зүй",
    text: "Судалгааны таамаглал (гипотез) гэж юуг хэлэх вэ?",
    options: [
      { id: "q1-o1", text: "Судалгааны төсөв, хугацааны нарийвчилсан төлөвлөгөө" },
      {
        id: "q1-o2",
        text: "Эмпирик өгөгдлөөр шалгаж болохуйц, няцаагдах боломжтой урьдчилсан мэдэгдэл",
      },
      { id: "q1-o3", text: "Судалгааны үр дүнг нийтэлсэн эрдэм шинжилгээний өгүүлэл" },
      { id: "q1-o4", text: "Түүврийн хэмжээг тодорхойлох статистик томьёо" },
    ],
    correctOptionId: "q1-o2",
    explanation:
      "Таамаглал нь онолоос урган гарсан, хэмжигдэхүйц хувьсагчдын хоорондын хамаарлыг илэрхийлсэн, эмпирик байдлаар шалгагдах бөгөөд няцаагдах боломжтой мэдэгдэл байх ёстой.",
  },
  standardError: {
    id: "q-standard-error",
    subject: "Статистик",
    text: "Түүврийн хэмжээ нэмэгдэхэд дундажийн стандарт алдаа хэрхэн өөрчлөгдөх вэ?",
    options: [
      { id: "q2-o1", text: "Ихэснэ" },
      { id: "q2-o2", text: "Багасна" },
      { id: "q2-o3", text: "Өөрчлөгдөхгүй" },
      { id: "q2-o4", text: "Эхлээд багасаад дараа нь ихэснэ" },
    ],
    correctOptionId: "q2-o2",
    explanation:
      "Дундажийн стандарт алдаа нь σ/√n тул түүврийн хэмжээ n нэмэгдэхэд алдаа багасч, тооцооллын нарийвчлал сайжирна.",
  },
  correlation: {
    id: "q-correlation",
    subject: "Статистик",
    text: "Хоёр хувьсагчийн хоорондын корреляцийн коэффициент r = −0.85 байвал энэ нь юуг илэрхийлэх вэ?",
    options: [
      { id: "q3-o1", text: "Хүчтэй сөрөг шугаман хамаарал" },
      { id: "q3-o2", text: "Сул сөрөг шугаман хамаарал" },
      { id: "q3-o3", text: "Хүчтэй эерэг шугаман хамаарал" },
      { id: "q3-o4", text: "Хамаарал огт байхгүй" },
    ],
    correctOptionId: "q3-o1",
    explanation:
      "Коэффициентийн үнэмлэхүй утга 1-д ойртох тусам шугаман хамаарал хүчтэй, хасах тэмдэг нь урвуу чиглэлийг заана.",
  },
  qualitative: {
    id: "q-qualitative",
    subject: "Судалгааны арга зүй",
    text: "Чанарын судалгаанд өгөгдөл цуглуулах дараах аргуудаас аль нь хамаарахгүй вэ?",
    options: [
      { id: "q4-o1", text: "Гүнзгийрүүлсэн ярилцлага" },
      { id: "q4-o2", text: "Фокус бүлгийн хэлэлцүүлэг" },
      { id: "q4-o3", text: "Оролцооны ажиглалт" },
      { id: "q4-o4", text: "Санамсаргүй хуваарилалттай хяналтат туршилт" },
    ],
    correctOptionId: "q4-o4",
    explanation:
      "Санамсаргүй хуваарилалттай хяналтат туршилт нь тоон судалгааны туршилтын загварт хамаарна.",
  },
  citation: {
    id: "q-citation",
    subject: "Эрдэм шинжилгээний бичиг",
    text: "APA 7 хэв маягаар ном зүйд зохиогчийн нэрийг хэрхэн бичих вэ?",
    options: [
      { id: "q5-o1", text: "Овог, нэрийн эхний үсэг" },
      { id: "q5-o2", text: "Бүтэн нэр, дараа нь овог" },
      { id: "q5-o3", text: "Зөвхөн нэр" },
      { id: "q5-o4", text: "Овог, дараа нь бүтэн нэр" },
    ],
    correctOptionId: "q5-o1",
    explanation: "APA 7-д зохиогчийг овгоор нь, нэрийг товчилсон үсгээр бичнэ.",
  },
  // Long stem, six options, and a pinned last option: the densest layout the card has
  // to hold at 360px.
  consent: {
    id: "q-consent",
    subject: "Судалгааны ёс зүй",
    text: "Судалгаанд оролцогчоос мэдээлэлд суурилсан зөвшөөрөл (informed consent) авахдаа оролцогчид ямар мэдээллийг заавал танилцуулах ёстой вэ? Судалгааны зорилго, эрсдэл, оролцогчийн эрх, нууцлалын асуудлыг бүхэлд нь харгалзан үзнэ үү.",
    options: [
      { id: "q6-o1", text: "Судалгааны зорилго, үргэлжлэх хугацаа" },
      { id: "q6-o2", text: "Оролцогчид учирч болох эрсдэл, ашиг тус" },
      { id: "q6-o3", text: "Оролцогч хүссэн үедээ татгалзах эрхтэй болох" },
      { id: "q6-o4", text: "Цуглуулсан мэдээллийн нууцлалыг хэрхэн хамгаалах" },
      { id: "q6-o5", text: "Судлаач болон ёс зүйн хороотой холбогдох мэдээлэл" },
      { id: "q6-o6", text: "Дээрх бүгд зөв" },
    ],
    correctOptionId: "q6-o6",
    explanation:
      "Зөвшөөрлийн маягтад дээрх бүх мэдээлэл багтах бөгөөд оролцогч ямар ч үед үр дагаваргүйгээр татгалзах эрхтэй.",
  },
};

/** The four questions the exam demo runs through. */
export const EXAM_QUESTIONS: DemoQuestion[] = [
  DEMO_QUESTIONS.correlation,
  DEMO_QUESTIONS.consent,
  DEMO_QUESTIONS.qualitative,
  DEMO_QUESTIONS.citation,
];

/**
 * A fixed 30-day window for the dashboard chart. Deterministic (no Math.random and no
 * clock), so the showcase looks the same on every render.
 */
const DEMO_TOTALS = [
  0, 12, 8, 0, 0, 20, 14, 6, 0, 3, 18, 22, 9, 0, 0, 11, 16, 4, 7, 0, 25, 13, 0, 5, 19,
  10, 0, 15, 21, 6,
];

export const DEMO_ACTIVITY: ActivityRow[] = dayKeysBack("2026-09-17", 30).map((day, index) => ({
  day,
  total: DEMO_TOTALS[index],
  correct: Math.round(DEMO_TOTALS[index] * 0.7),
}));

/** Three subjects, weakest first, as getSubjectStats() orders them. */
export const DEMO_SUBJECTS: SubjectStats[] = [
  {
    subjectId: "s-methods",
    subjectName: "Судалгааны арга зүй",
    total: 120,
    seen: 24,
    mastered: 6,
    answered: 31,
    correct: 17,
    accuracy: 17 / 31,
  },
  {
    subjectId: "s-stats",
    subjectName: "Статистик",
    total: 90,
    seen: 61,
    mastered: 28,
    answered: 104,
    correct: 79,
    accuracy: 79 / 104,
  },
  {
    subjectId: "s-philosophy",
    subjectName: "Философи",
    total: 45,
    seen: 0,
    mastered: 0,
    answered: 0,
    correct: 0,
    accuracy: null,
  },
];
