import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { db } from "@/lib/db";
import { logout } from "@/app/actions/auth";
import { UnlockForm } from "./unlock-form";
import { userLabel } from "@/lib/identity";
import { Icon } from "@/components/icon";

export const metadata = { title: "Locked" };

export default async function Lock() {
  const s = await readSession();
  if (!s) redirect("/login");
  if (!s.locked) redirect("/dashboard");
  const user = await db.user.findUnique({ where: { id: s.uid } });
  return (
    <main className="mx-auto flex min-h-screen max-w-xs flex-col justify-center px-4 text-center">
      <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-brand-soft text-brand"><Icon name="lock" size={26} /></span>
      <h1 className="text-xl font-semibold tracking-tight">Locked</h1>
      <p className="mb-6 mt-1 text-sm text-muted">{userLabel(user)}, enter your PIN to continue.</p>
      <UnlockForm />
      <form action={logout} className="mt-6">
        <button className="text-sm text-muted underline">Sign out instead</button>
      </form>
    </main>
  );
}
