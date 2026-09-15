import "dotenv/config";
import { createPrismaClient } from "../src/lib/prisma";

// Idempotent demo seed: every write is keyed on a stable unique value
// (Subject.slug, Question.code, Option (questionId, sortOrder), fixed preset id),
// so running it repeatedly creates no duplicates.

const prisma = createPrismaClient(process.env.DIRECT_URL);

type SubjectSlug = "research-methodology" | "philosophy-of-science";

type SeedOption = { text: string; isCorrect?: boolean; pinned?: boolean };

type SeedQuestion = {
  code: string;
  subject: SubjectSlug;
  text: string;
  explanation: string;
  lockOptions?: boolean;
  isActive?: boolean;
  options: SeedOption[];
};

const subjects: { slug: SubjectSlug; name: string; sortOrder: number }[] = [
  { slug: "research-methodology", name: "Судалгааны арга зүй", sortOrder: 1 },
  { slug: "philosophy-of-science", name: "Шинжлэх ухааны философи", sortOrder: 2 },
];

const questions: SeedQuestion[] = [
  {
    code: "DEMO-001",
    subject: "research-methodology",
    text: "Судалгааны таамаглал (гипотез) гэж юу вэ?",
    explanation:
      "Таамаглал нь судалгааны өмнө дэвшүүлж, эмпирик өгөгдлөөр батлах эсвэл няцаах урьдчилсан тайлбар юм.",
    options: [
      {
        text: "Судалгаагаар шалгагдах, хувьсагчдын хоорондын хамаарлын талаарх урьдчилсан тайлбар",
        isCorrect: true,
      },
      { text: "Судалгааны эцсийн дүгнэлт" },
      { text: "Судалгаанд ашигласан эх сурвалжийн жагсаалт" },
      { text: "Судалгааны объектын тодорхойлолт" },
    ],
  },
  {
    code: "DEMO-002",
    subject: "research-methodology",
    text: "Дараахаас аль нь чанарын судалгааны арга вэ?",
    explanation:
      "Гүнзгийрүүлсэн ярилцлага нь оролцогчийн туршлага, үзэл бодлыг нарийвчлан судлах чанарын арга юм. Бусад нь тоон шинжилгээний аргууд.",
    options: [
      { text: "Гүнзгийрүүлсэн ярилцлага", isCorrect: true },
      { text: "Регрессийн шинжилгээ" },
      { text: "Санамсаргүй хяналттай туршилт" },
      { text: "Корреляцийн шинжилгээ" },
      { text: "Факторын шинжилгээ" },
    ],
  },
  {
    code: "DEMO-003",
    subject: "research-methodology",
    text: "Түүврийн хэмжээг ихэсгэхэд юу болдог вэ?",
    explanation:
      "Түүврийн хэмжээ өсөх тусам түүврийн үзүүлэлт эх олонлогийн параметрт ойртож, түүврийн алдаа буурдаг.",
    options: [
      { text: "Түүврийн алдаа багасна", isCorrect: true },
      { text: "Түүврийн алдаа ихэснэ" },
      { text: "Хэмжилтийн хүчин төгөлдөр байдал заавал нэмэгдэнэ" },
      { text: "Судалгааны зардал багасна" },
    ],
  },
  {
    // Pinned "Бүгд зөв" option stays last when the other options are shuffled.
    code: "DEMO-004",
    subject: "research-methodology",
    text: "Дараахаас аль нь судалгааны ёс зүйн зарчимд хамаарах вэ?",
    explanation:
      "Мэдээлэлтэй зөвшөөрөл авах, нууцлалыг хамгаалах, хор хөнөөл учруулахгүй байх нь судалгааны ёс зүйн үндсэн зарчмууд тул бүгд зөв.",
    options: [
      { text: "Оролцогчоос мэдээлэлтэй зөвшөөрөл авах" },
      { text: "Оролцогчийн нууцлалыг хамгаалах" },
      { text: "Оролцогчид хор хөнөөл учруулахгүй байх" },
      { text: "Бүгд зөв", isCorrect: true, pinned: true },
    ],
  },
  {
    // Options reference each other by letter, so their order must never change.
    code: "DEMO-005",
    subject: "research-methodology",
    text: "Хэмжилтийн найдвартай байдлыг (reliability) үнэлэх аргыг сонгоно уу.",
    explanation:
      "Давтан хэмжилтийн арга болон Кронбахын альфа коэффициент хоёулаа хэмжилтийн найдвартай байдлыг үнэлдэг. Түүврийн хэмжээг тооцох нь найдвартай байдлын үнэлгээ биш.",
    lockOptions: true,
    options: [
      { text: "Давтан хэмжилтийн (test-retest) арга" },
      { text: "Түүврийн хэмжээг тооцох арга" },
      { text: "Кронбахын альфа коэффициент" },
      { text: "А ба В зөв", isCorrect: true },
    ],
  },
  {
    code: "DEMO-006",
    subject: "research-methodology",
    text: "Бие даасан хувьсагч гэж юу вэ?",
    explanation:
      "Бие даасан хувьсагчийг судлаач өөрчилж, хамааралтай хувьсагчид үзүүлэх нөлөөг нь ажигладаг.",
    options: [
      { text: "Судлаачийн өөрчилж, нөлөөг нь судалж буй хувьсагч", isCorrect: true },
      { text: "Бусад хувьсагчийн нөлөөгөөр өөрчлөгдөж буй хувьсагч" },
      { text: "Судалгаанд хэмжигдээгүй хувьсагч" },
      { text: "Үргэлж тогтмол байх хувьсагч" },
    ],
  },
  {
    code: "DEMO-007",
    subject: "philosophy-of-science",
    text: "Фальсификацийн зарчмыг хэн дэвшүүлсэн бэ?",
    explanation:
      "Карл Поппер шинжлэх ухааны онол нь няцаагдах боломжтой байх ёстой гэсэн фальсификацийн зарчмыг дэвшүүлсэн.",
    options: [
      { text: "Карл Поппер", isCorrect: true },
      { text: "Томас Кун" },
      { text: "Огюст Конт" },
      { text: "Имре Лакатош" },
      { text: "Пол Фейерабенд" },
    ],
  },
  {
    code: "DEMO-008",
    subject: "philosophy-of-science",
    text: "«Шинжлэх ухааны хувьсгалын бүтэц» бүтээлдээ «парадигм» ойлголтыг дэлгэрүүлсэн эрдэмтэн хэн бэ?",
    explanation:
      "Томас Кун 1962 онд хэвлүүлсэн «Шинжлэх ухааны хувьсгалын бүтэц» бүтээлдээ парадигмын ойлголтыг дэлгэрүүлсэн.",
    options: [
      { text: "Томас Кун", isCorrect: true },
      { text: "Карл Поппер" },
      { text: "Рене Декарт" },
      { text: "Фрэнсис Бэкон" },
    ],
  },
  {
    code: "DEMO-009",
    subject: "philosophy-of-science",
    text: "Индукц гэж юу вэ?",
    explanation:
      "Индукц нь тухайн ажиглалтаас ерөнхий дүгнэлтэд шилждэг. Харин ерөнхийгөөс тухайд шилжих нь дедукц юм.",
    options: [
      { text: "Тухайн тохиолдлуудаас ерөнхий дүгнэлт гаргах сэтгэлгээний арга", isCorrect: true },
      { text: "Ерөнхий зарчмаас тухайн тохиолдлын талаар дүгнэлт гаргах арга" },
      { text: "Онолыг туршилтгүйгээр батлах арга" },
      { text: "Өгөгдлийг ангилах статистик арга" },
    ],
  },
  {
    code: "DEMO-010",
    subject: "philosophy-of-science",
    text: "Позитивизмыг үндэслэгч хэн бэ?",
    explanation:
      "Огюст Конт XIX зуунд позитивизмыг үндэслэж, мэдлэг нь ажиглалт, туршлагад тулгуурлах ёстой гэж үзсэн.",
    options: [
      { text: "Огюст Конт", isCorrect: true },
      { text: "Иммануил Кант" },
      { text: "Георг Гегель" },
      { text: "Дэвид Юм" },
    ],
  },
  {
    code: "DEMO-011",
    subject: "philosophy-of-science",
    text: "Эмпиризмын үндсэн санаа аль нь вэ?",
    explanation:
      "Эмпиризм нь мэдлэг мэдрэхүйн туршлагаас эх авдаг гэж үздэг бол рационализм оюун ухааныг мэдлэгийн тэргүүлэх эх сурвалж гэж үздэг.",
    options: [
      { text: "Мэдлэгийн үндсэн эх сурвалж нь мэдрэхүйн туршлага", isCorrect: true },
      { text: "Мэдлэгийн цорын ганц эх сурвалж нь оюун ухаан" },
      { text: "Бодит ертөнцийг танин мэдэх боломжгүй" },
      { text: "Үнэн гэдэг нь зөвхөн нийгмийн тохиролцоо" },
      { text: "Шинжлэх ухаан нь шашнаас гаралтай" },
    ],
  },
  {
    // Inactive: must never appear in practice or exam attempts.
    code: "DEMO-012",
    subject: "philosophy-of-science",
    text: "«Оккамын сахлын хутга» зарчмын утга аль нь вэ?",
    explanation:
      "Оккамын сахлын хутга нь шаардлагагүй таамаглал нэмэхгүйгээр хамгийн энгийн тайлбарыг илүүд үзэхийг заадаг.",
    isActive: false,
    options: [
      { text: "Ижил тайлбарлах чадвартай онолуудаас хамгийн энгийнийг нь сонгох", isCorrect: true },
      { text: "Хамгийн нарийн төвөгтэй онолыг сонгох" },
      { text: "Онолыг зөвхөн туршилтаар батлах" },
      { text: "Бүх онолыг адил үнэн гэж үзэх" },
    ],
  },
];

const TRIAL_PRESET_ID = "seed-preset-trial";

async function main() {
  const subjectIds = new Map<SubjectSlug, string>();
  for (const s of subjects) {
    const subject = await prisma.subject.upsert({
      where: { slug: s.slug },
      update: { name: s.name, sortOrder: s.sortOrder },
      create: s,
    });
    subjectIds.set(s.slug, subject.id);
  }

  for (const q of questions) {
    const correct = q.options.filter((o) => o.isCorrect).length;
    if (correct !== 1) {
      throw new Error(`${q.code}: expected exactly 1 correct option, got ${correct}`);
    }

    const data = {
      subjectId: subjectIds.get(q.subject)!,
      text: q.text,
      explanation: q.explanation,
      lockOptions: q.lockOptions ?? false,
      isActive: q.isActive ?? true,
    };
    const question = await prisma.question.upsert({
      where: { code: q.code },
      update: data,
      create: { code: q.code, ...data },
    });

    await prisma.$transaction([
      ...q.options.map((o, i) => {
        const option = {
          text: o.text,
          isCorrect: o.isCorrect ?? false,
          pinned: o.pinned ?? false,
        };
        return prisma.option.upsert({
          where: { questionId_sortOrder: { questionId: question.id, sortOrder: i } },
          update: option,
          create: { questionId: question.id, sortOrder: i, ...option },
        });
      }),
      prisma.option.deleteMany({
        where: { questionId: question.id, sortOrder: { gte: q.options.length } },
      }),
    ]);
  }

  // 10 questions: 5 from each subject (each has at least 5 active questions).
  const preset = {
    name: "Туршилтын шалгалт",
    questionCount: 10,
    timeLimitMin: 15,
    distribution: {
      [subjectIds.get("research-methodology")!]: 5,
      [subjectIds.get("philosophy-of-science")!]: 5,
    },
    isActive: true,
    sortOrder: 0,
  };
  await prisma.examPreset.upsert({
    where: { id: TRIAL_PRESET_ID },
    update: preset,
    create: { id: TRIAL_PRESET_ID, ...preset },
  });

  console.log(
    `Seeded ${subjects.length} subjects, ${questions.length} questions, 1 exam preset.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
