import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logout, switchBusiness } from "@/app/actions/auth";
import { Icon } from "@/components/icon";
import { buttonClass } from "@/components/ui";
import { BRAND } from "@/lib/brand";

export const metadata = { title: "Shop paused" };

// Where people land when the shop they are using has been paused by the platform.
export default async function Suspended() {
  const { user, session } = await requireUser();
  const memberships = await db.membership.findMany({ where: { userId: user.id }, include: { business: true }, orderBy: { createdAt: "asc" } });
  const current = memberships.find((m) => m.businessId === session.bid)?.business;
  if (current && !current.suspendedAt) redirect("/dashboard");
  const others = memberships.filter((m) => !m.business.suspendedAt && m.businessId !== current?.id);
  const support = process.env.SUPPORT_EMAIL;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-5 text-center">
      <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-warn/10 text-warn"><Icon name="lock" size={26} /></span>
      <h1 className="text-xl font-semibold tracking-tight">{current ? `${current.name} is paused` : "Your shop is paused"}</h1>
      <p className="mt-2 text-sm text-muted">
        {BRAND.NAME} has paused this shop, so it can’t be opened for now. Your records are safe and nothing has been deleted.
      </p>
      {current?.suspendedReason && (
        <p className="mt-4 rounded-lg border border-line bg-card px-4 py-3 text-sm shadow-[var(--shadow)]">
          <span className="block text-xs font-medium text-muted">Message from {BRAND.NAME}</span>
          {current.suspendedReason}
        </p>
      )}
      <p className="mt-4 text-sm text-muted">
        {support ? <>To get it opened again, write to <a className="font-medium text-brand underline" href={`mailto:${support}`}>{support}</a>.</> : "To get it opened again, please contact the person who runs this service."}
      </p>

      <div className="mt-6 flex w-full flex-col gap-2">
        {others.map((m) => (
          <form key={m.businessId} action={switchBusiness}>
            <input type="hidden" name="businessId" value={m.businessId} />
            <button className={`${buttonClass("primary")} w-full`}>Open {m.business.name}</button>
          </form>
        ))}
        <form action={logout}><button className={`${buttonClass("secondary")} w-full`}>Sign out</button></form>
      </div>
    </main>
  );
}
