import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { revokeSession, unlinkMethod } from "@/app/actions/auth";
import { googleEnabled } from "@/lib/google";
import { isPlatformAdmin } from "@/lib/platform-auth";
import { Badge } from "@/components/ui";
import { EmailLink } from "./email-link";
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

export default async function Security({ searchParams }: PageProps<"/settings/security">) {
  const sp = await searchParams;
  const { user, session } = await requireBusiness();
  const methods = [user.phone, user.email, user.googleSub].filter(Boolean).length;
  const admin = isPlatformAdmin(user);
  const sessions = await db.session.findMany({
    where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastActiveAt: "desc" },
  });
  const time = (d: Date) => d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <PageHeader title="You & your security" sub="Your name, language, how screens look, app lock and devices." />
      {sp.linked === "google" && <p role="status" className="mb-4 rounded-lg bg-got/10 px-3 py-2.5 text-sm text-got">Google is now connected. You can sign in with it.</p>}
      {sp.error === "google_taken" && <p role="alert" className="mb-4 rounded-lg bg-gave/10 px-3 py-2.5 text-sm text-gave">That Google account is already used by another person here.</p>}
      {sp.admin === "1" && <p role="alert" className="mb-4 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2.5 text-sm text-warn">Set an app lock PIN below to use the platform admin area.</p>}

      <Card className="mb-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight">How you sign in</h2>
          <p className="text-sm text-muted">Add more than one way, so you can always get back in.</p>
        </div>
        <ul className="divide-y divide-line">
          <li className="flex flex-wrap items-center justify-between gap-2 py-3">
            <span><span className="block font-medium">Mobile number</span><span className="text-sm text-muted">{user.phone ? `+${user.phone}` : "Not added"}</span></span>
            {user.phone && <Badge tone="good">Verified</Badge>}
          </li>
          <li className="space-y-2 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span><span className="block font-medium">Email</span><span className="text-sm text-muted">{user.email ?? "Not added"}</span></span>
              {user.email && <Badge tone="good">Verified</Badge>}
            </div>
            {!user.email && <EmailLink />}
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2 py-3">
            <span><span className="block font-medium">Google</span><span className="text-sm text-muted">{user.googleSub ? "Connected" : googleEnabled() ? "Not connected" : "Not switched on yet"}</span></span>
            {user.googleSub ? (
              methods > 1 && (
                <form action={unlinkMethod}><input type="hidden" name="which" value="google" /><button className="text-sm text-muted underline hover:text-gave">Disconnect</button></form>
              )
            ) : googleEnabled() ? (
              <a href="/api/auth/google?link=1" className="inline-flex min-h-9 items-center rounded-lg border border-line bg-card px-3 text-sm font-medium shadow-sm hover:bg-bg">Connect Google</a>
            ) : null}
          </li>
        </ul>
        {admin && <p className="text-sm text-muted">You are a platform admin. <a className="text-brand underline" href="/platform">Open the admin area</a></p>}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-base font-semibold tracking-tight">Your name</h2>
          <NameForm name={user.name ?? ""} />
          <div className="border-t border-line pt-3"><PreferencesForm lang={user.uiLanguage} mode={user.uiMode} /></div>
        </Card>
        <Card className="space-y-3">
          <h2 className="text-base font-semibold tracking-tight">App lock</h2>
          <p className="text-sm text-muted">
            {user.pinHash
              ? `On. The app locks after ${user.lockAfterMin} minute${user.lockAfterMin === 1 ? "" : "s"} without use and asks for your PIN.`
              : "Off. Set a PIN so nobody can open your accounts on an unattended phone or computer."}
          </p>
          <PinForm hasPin={!!user.pinHash} lockAfterMin={user.lockAfterMin} />
        </Card>
      </div>

      <h2 className="mb-2 mt-6 text-base font-semibold tracking-tight">Signed-in devices</h2>
      <Card className="divide-y divide-line p-0 text-sm">
        {sessions.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <span>
              <span className="font-medium">{device(s.userAgent)}</span>
              {s.id === session.sid && <span className="ml-2 rounded bg-brand/10 px-1.5 py-0.5 text-xs text-brand">this device</span>}
              <span className="block text-xs text-muted">
                Signed in {fmtDate(s.createdAt)} · last active {fmtDate(s.lastActiveAt)} {time(s.lastActiveAt)}{s.ip && ` · ${s.ip}`}
              </span>
            </span>
            {s.id !== session.sid && (
              <form action={revokeSession}>
                <input type="hidden" name="sessionId" value={s.id} />
                <button className="text-xs text-muted underline hover:text-gave">Sign out</button>
              </form>
            )}
          </div>
        ))}
      </Card>
      {sessions.length > 1 && (
        <form action={revokeSession} className="mt-3">
          <input type="hidden" name="sessionId" value="others" />
          <button className="text-sm text-muted underline hover:text-gave">Sign out all other devices</button>
        </form>
      )}
    </>
  );
}
