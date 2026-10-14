import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { revokeSession } from "@/app/actions/auth";
import { Card, PageHeader, fmtDate } from "@/components/ui";
import { NameForm, PinForm, PreferencesForm } from "./forms";

export const metadata = { title: "You & your security" };

/** Rough device label from a user-agent string. */
function device(ua: string | null): string {
  if (!ua) return "Unknown device";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${browser} on ${os}`;
}

export default async function Security() {
  const { user, session } = await requireBusiness();
  const sessions = await db.session.findMany({
    where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastActiveAt: "desc" },
  });
  const time = (d: Date) => d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <PageHeader title="You & your security" sub="Your name, language, how screens look, app lock and devices." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="font-semibold">Your name</h2>
          <NameForm name={user.name ?? ""} />
          <div className="border-t border-line pt-3"><PreferencesForm lang={user.uiLanguage} mode={user.uiMode} /></div>
        </Card>
        <Card className="space-y-3">
          <h2 className="font-semibold">App lock</h2>
          <p className="text-base text-muted">
            {user.pinHash
              ? `On. The app locks after ${user.lockAfterMin} minute${user.lockAfterMin === 1 ? "" : "s"} without use and asks for your PIN.`
              : "Off. Set a PIN so nobody can open your accounts on an unattended phone or computer."}
          </p>
          <PinForm hasPin={!!user.pinHash} lockAfterMin={user.lockAfterMin} />
        </Card>
      </div>

      <h2 className="mb-2 mt-6 font-semibold">Signed-in devices</h2>
      <Card className="divide-y divide-line p-0 text-base">
        {sessions.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <span>
              <span className="font-medium">{device(s.userAgent)}</span>
              {s.id === session.sid && <span className="ml-2 rounded bg-brand/10 px-1.5 py-0.5 text-sm text-brand">this device</span>}
              <span className="block text-sm text-muted">
                Signed in {fmtDate(s.createdAt)} · last active {fmtDate(s.lastActiveAt)} {time(s.lastActiveAt)}{s.ip && ` · ${s.ip}`}
              </span>
            </span>
            {s.id !== session.sid && (
              <form action={revokeSession}>
                <input type="hidden" name="sessionId" value={s.id} />
                <button className="text-sm text-muted underline hover:text-gave">Sign out</button>
              </form>
            )}
          </div>
        ))}
      </Card>
      {sessions.length > 1 && (
        <form action={revokeSession} className="mt-3">
          <input type="hidden" name="sessionId" value="others" />
          <button className="text-base text-muted underline hover:text-gave">Sign out all other devices</button>
        </form>
      )}
    </>
  );
}
