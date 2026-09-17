// Builds data/template.xlsx: the sheet an operator fills in, plus a "Заавар" sheet
// documenting every column. Used by `pnpm template:make` and by the admin-only
// download route, so the file offered in the panel is never a stale copy on disk.

import ExcelJS from "exceljs";
import { HEADERS, type Header } from "./types";

export const TEMPLATE_FILE_NAME = "question-template.xlsx";

type ExampleRow = Record<Header, string>;

function example(values: Partial<ExampleRow>): ExampleRow {
  const empty = Object.fromEntries(HEADERS.map((header) => [header, ""])) as ExampleRow;
  return { ...empty, ...values };
}

const EXAMPLES: ExampleRow[] = [
  example({
    code: "ARG-001",
    subject: "Судалгааны арга зүй",
    question: "Судалгааны таамаглал (гипотез) гэж юу вэ?",
    option_1: "Судалгааны эцсийн дүгнэлт",
    option_2: "Хувьсагчдын хоорондын хамаарлын талаарх, шалгагдах урьдчилсан тайлбар",
    option_3: "Судалгаанд ашигласан эх сурвалжийн жагсаалт",
    option_4: "Судалгааны объектын тодорхойлолт",
    correct: "b",
    explanation: "Таамаглалыг эмпирик өгөгдлөөр батлах эсвэл няцаах боломжтой байх ёстой.",
  }),
  example({
    code: "ARG-002",
    subject: "Судалгааны арга зүй",
    question: "Дараахаас аль нь судалгааны ёс зүйн зарчимд хамаарах вэ?",
    option_1: "Оролцогчоос мэдээлэлтэй зөвшөөрөл авах",
    option_2: "Оролцогчийн нууцлалыг хамгаалах",
    option_3: "Оролцогчид хор хөнөөл учруулахгүй байх",
    option_4: "Бүгд зөв",
    // "Бүгд зөв" төрлийн хувилбарыг pinned гэж заавал заана: хольсон ч хамгийн сүүлд үлдэнэ.
    correct: "d",
    pinned: "d",
  }),
  example({
    code: "ARG-003",
    subject: "Шинжлэх ухааны философи",
    question: "Хэмжилтийн найдвартай байдлыг (reliability) үнэлэх аргыг сонгоно уу.",
    option_1: "Давтан хэмжилтийн арга",
    option_2: "Түүврийн хэмжээг тооцох арга",
    option_3: "Кронбахын альфа коэффициент",
    option_4: "А ба В зөв",
    // Хувилбарууд бие биеэ үсгээр иш татсан тул дараалал хөдөлж болохгүй.
    correct: "d",
    lock: "1",
  }),
  example({
    code: "ARG-004",
    subject: "Шинжлэх ухааны философи",
    question: "Энэ асуулт номноос хасагдсан тул идэвхгүй байна.",
    option_1: "Зөв хувилбар",
    option_2: "Буруу хувилбар",
    correct: "a",
    // active = 0 бол асуулт санд үлдэнэ, гэхдээ дадлага, шалгалтад гарахгүй.
    active: "0",
  }),
];

const GUIDE: [string, string, string][] = [
  ["Багана", "Заавал", "Тайлбар"],
  ["code", "Тийм", "Асуултын дахин давтагдашгүй код (ж: NEZ-P247-18 = бүлэг, хуудас, асуултын дугаар). Импорт асуултыг ЭНЭ кодоор нь таньдаг тул кодыг дараа нь өөрчлөхгүй."],
  ["subject", "Тийм", "Номын бүлгийн нэр. Ижил нэртэй бүлгүүд нэг Subject болж нэгдэнэ. Импорт судлагдахууныг НЭРЭЭР нь тааруулдаг."],
  ["question", "Тийм", "Асуултын бүтэн текст (кирилл). Хувилбарын үсгийг оруулахгүй."],
  ["option_1 … option_6", "Тийм (доод тал нь 2)", "Хувилбарын текст. Хоосон нүд алгасагдана. correct/pinned нь эх баганын дугаарыг заана."],
  ["correct", "Тийм", "Зөв хувилбар: 1-6 тоо эсвэл латин a-f үсэг. Кирилл а, с, е-г латинаар нь тооцно; бусад кирилл үсэг (б, в, г, д) эргэлзээтэй тул алдаа болно."],
  ["pinned", "Үгүй", 'Үргэлж сүүлд байх хувилбаруудын дугаар/үсэг, таслалаар (ж: "d" = "Бүгд зөв").'],
  ["lock", "Үгүй", '"1" эсвэл "true" бол тухайн асуултын хувилбарууд хольцгүй, эх дараалалдаа хэвээр үлдэнэ.'],
  ["explanation", "Үгүй", "Хариултын тайлбар. Сурагчид хариулсны дараа харагдана."],
  ["image_url", "Үгүй", "Асуултад зураг байвал түүний URL."],
  [
    "active",
    "Үгүй",
    '"1" = идэвхтэй, "0" = идэвхгүй (санд үлдэнэ, гэхдээ дадлага/шалгалтад гарахгүй). ' +
      "Нүдийг хоосон орхивол одоогийн төлөв нь хэвээр үлдэнэ. Энэ багана огт байхгүй файл (хуучин файлууд) " +
      "хэвийн импортлогдож, ямар ч асуултын идэвхийг өөрчлөхгүй.",
  ],
  ["", "", ""],
  ["Анхаарах", "", "Зөвхөн эхний хуудас (questions) уншигдана. Энэ Заавар хуудас нь импортод оролцохгүй."],
  ["Анхаарах", "", "Зөв хариултыг таамаглаж бөглөж болохгүй — номын хариултын түлхүүрээс авна."],
  ["Анхаарах", "", "Байгаа асуултын зөв хариултыг өөрчилбөл тухайн асуултыг хариулсан хэрэглэгчдийн давтлага тэглэгдэнэ; админ хэсэг үүнийг тусад нь баталгаажуулж асууна."],
  ["Анхаарах", "", "Шалгах: pnpm import:questions <файл> --dry-run"],
];

/** The template workbook, built fresh each time it is asked for. */
export async function buildTemplateWorkbook(): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "phd-prep";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("questions", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.addRow([...HEADERS]);
  sheet.getRow(1).font = { bold: true };
  for (const row of EXAMPLES) sheet.addRow(HEADERS.map((header) => row[header]));
  sheet.columns = HEADERS.map((header) => ({
    width: header === "question" || header.startsWith("option") || header === "explanation" ? 42 : 16,
  }));

  const guide = workbook.addWorksheet("Заавар");
  for (const row of GUIDE) guide.addRow(row);
  guide.getRow(1).font = { bold: true };
  guide.columns = [{ width: 24 }, { width: 22 }, { width: 96 }];
  guide.eachRow((row) => {
    row.getCell(3).alignment = { wrapText: true, vertical: "top" };
  });

  return workbook;
}

export async function buildTemplateBuffer(): Promise<Buffer> {
  const workbook = await buildTemplateWorkbook();
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** Example rows the template ships with, for tests and for the CLI's summary. */
export const TEMPLATE_EXAMPLE_COUNT = EXAMPLES.length;
