import { auth } from "@clerk/nextjs/server";
import { AppNav } from "@/components/app-nav";
import { isAdmin, requireUser } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await auth.protect();
  // Creates the DB user on the first signed-in visit.
  await requireUser();
  const admin = await isAdmin();

  return (
    <>
      <AppNav isAdmin={admin} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
    </>
  );
}
