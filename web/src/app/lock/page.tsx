import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { db } from "@/lib/db";
import { logout } from "@/app/actions/auth";
import { UnlockForm } from "./unlock-form";

export const metadata = { title: "Locked" };

export default async function Lock() {
  const s = await readSession();
  if (!s) redirect("/login");
  if (!s.locked) redirect("/dashboard");
  const user = await db.user.findUnique({ where: { id: s.uid } });
  return (
    <main className="mx-auto flex min-h-screen max-w-xs flex-col justify-center px-4 text-center">
      <p className="text-4xl" aria-hidden>🔒</p>
      <h1 className="mt-2 text-xl font-bold">Locked</h1>
      <p className="mb-6 text-base text-muted">{user?.name ?? `+${user?.phone}`}, enter your PIN to continue.</p>
      <UnlockForm />
      <form action={logout} className="mt-6">
        <button className="text-base text-muted underline">Sign out instead</button>
      </form>
    </main>
  );
}
