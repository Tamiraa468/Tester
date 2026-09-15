export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      <h1 className="text-center text-2xl font-semibold">
        Докторантурын элсэлтийн шалгалтын бэлтгэл
      </h1>
      {/* Font check: Ө ө Ү ү must render in the same font as other letters. */}
      <div className="flex flex-col items-center gap-2 text-center text-3xl">
        <p className="font-normal">Өдөр бүр үргэлжлүүлэн давтаарай</p>
        <p className="font-bold">Өдөр бүр үргэлжлүүлэн давтаарай</p>
      </div>
    </main>
  );
}
