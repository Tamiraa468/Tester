/**
 * Every repeated user-facing string, in one place. There is no i18n library and no
 * second locale: the app ships in Mongolian only, so this file is a *vocabulary*, not
 * a translation table. Its job is that one idea is always worded the same way — the
 * exam flag is never called a bookmark, "Давтах" never becomes "Дахин үзэх".
 *
 * What belongs here: the core vocabulary, and any string that appears in more than one
 * component. What does not: a page's own one-off prose (an intro paragraph, an FAQ
 * answer), which reads better next to the markup it describes.
 */

/**
 * The eight words the whole product is named after. Everything else in this file, and
 * every label in the UI, is built from these — never a synonym.
 */
export const vocab = {
  practice: "Дадлага",
  exam: "Шалгалт",
  review: "Давтах",
  wrong: "Алдсан",
  bookmarked: "Тэмдэглэсэн",
  mastered: "Цээжилсэн",
  dashboard: "Хяналтын самбар",
  bank: "Асуултын сан",
} as const;

export const mn = {
  app: {
    name: "Докторын тест",
    title: "Докторантурын элсэлтийн шалгалтын бэлтгэл",
    description:
      "Докторантурын элсэлтийн шалгалтын албан ёсны асуултын сангаар дадлага хийж, шалгалтын горимоор сорьж, алдсан асуултаа давтан бататгах бэлтгэлийн апп.",
  },

  nav: {
    dashboard: vocab.dashboard,
    practice: vocab.practice,
    exam: vocab.exam,
    review: vocab.review,
    admin: "Админ",
    menu: "Цэс",
    openMenu: "Цэс нээх",
    signIn: "Нэвтрэх",
    signUp: "Бүртгүүлэх",
    skipToContent: "Үндсэн хэсэг рүү шилжих",
  },

  theme: {
    label: "Загвар",
    toggle: "Өнгөний загвар солих",
    light: "Цайвар",
    dark: "Бараан",
    system: "Системийн дагуу",
  },

  /** Nouns and units that appear in counts and headings. */
  units: {
    question: "Асуулт",
    questions: "асуулт",
    answers: "хариулт",
    days: "хоног",
  },

  actions: {
    start: "Эхлэх",
    startPractice: "Дадлага эхлэх",
    startReview: "Давтаж эхлэх",
    startExam: "Шалгалт эхлэх",
    /** While a server action is building the attempt and has not redirected yet. */
    preparing: "Бэлтгэж байна…",
    continue: "Үргэлжлүүлэх",
    next: "Дараах",
    previous: "Өмнөх",
    nextQuestion: "Дараагийн асуулт",
    finish: "Дуусгах",
    finishExam: "Шалгалт дуусгах",
    showResult: "Дүн харах",
    retry: "Дахин оролдох",
    retryWrong: "Алдсанаа давтах",
    newPractice: "Шинэ дадлага",
    goHome: "Нүүр хуудас руу",
    goDashboard: "Хяналтын самбар руу",
    close: "Хаах",
    cancel: "Болих",
    clearAnswer: "Хариултаа арилгах",
  },

  /**
   * Answer states. Each one is a word, never only a colour: the UI spells these out
   * next to every green, red and amber thing it draws.
   */
  quiz: {
    correct: "Зөв",
    wrong: "Буруу",
    unanswered: "Хариулаагүй",
    answered: "Хариулсан",
    correctAnswer: "Зөв хариулт",
    yourAnswerCorrect: "Таны хариулт — зөв",
    yourAnswerWrong: "Таны хариулт — буруу",
    answeredCorrectly: "Зөв хариуллаа",
    answeredWrongly: "Буруу хариуллаа",
    notAnswered: "Хариулаагүй",
    explanation: "Тайлбар",
    /** The exam navigator, as a heading and as the sheet that opens it. */
    questionList: "Асуултууд",
    allAnswered: "Бүх асуултад хариулсан байна.",
    /** AttemptItem.flagged — the exam only. Never the bookmark. */
    flag: "Эргэж харах",
    /** The Bookmark model — practice and /review. Never the exam flag. */
    bookmark: "Тэмдэглэх",
    bookmarked: vocab.bookmarked,
    remainingTime: "Үлдсэн хугацаа",
    currentQuestion: "Одоогийн асуулт",
    onlyUnanswered: "Зөвхөн хариулаагүй",
    saving: "Хадгалж байна…",
    saved: "Хадгалсан",
    unsaved: "Хадгалагдаагүй",
    questionImage: "Асуултын зураг",
    progressLabel: "Хариулсан асуултын явц",
  },

  review: {
    due: vocab.review,
    wrong: vocab.wrong,
    bookmarked: vocab.bookmarked,
  },

  /** Skeletons, empty lists and error boundaries. */
  states: {
    loading: "Ачааллаж байна…",
    errorTitle: "Алдаа гарлаа",
    errorBody: "Түр зуурын алдаа гарлаа. Дахин оролдоно уу.",
    notFoundTitle: "Хуудас олдсонгүй",
    notFoundBody:
      "Хаяг буруу байна, эсвэл энэ хуудас устсан байж магадгүй. Нүүр хуудаснаас үргэлжлүүлнэ үү.",
    emptyAttempts: "Та одоогоор дадлага, шалгалт дуусгаагүй байна.",
    emptyExams: "Та одоогоор шалгалт өгөөгүй байна.",
    emptyPresets: "Одоогоор шалгалтын төрөл алга.",
    emptyDue: "Одоогоор давтах хугацаа болсон асуулт алга. Сайн байна!",
    emptyWrong: "Алдсан асуулт алга байна.",
    emptyBookmarked: "Та одоогоор асуулт тэмдэглээгүй байна.",
    emptyWrongInAttempt: "Буруу хариулсан асуулт алга.",
  },

  /** Failed server actions. Toasts use these; the wording never blames the user. */
  errors: {
    generic: "Алдаа гарлаа. Дахин оролдоно уу.",
    network: "Сүлжээний алдаа гарлаа.",
    loadFailed: (what: string) => `${what} ачаалж чадсангүй`,
  },
} as const;
