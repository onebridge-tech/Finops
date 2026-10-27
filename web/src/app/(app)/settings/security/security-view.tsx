import type { User } from "@prisma/client";
import { db } from "@/lib/db";
import { revokeSession, unlinkMethod } from "@/app/actions/auth";
import { googleEnabled } from "@/lib/google";
import { isPlatformAdmin, serverAdminEmail } from "@/lib/platform-auth";
import { Badge } from "@/components/ui";
import { EmailLink } from "./email-link";
import { Card, PageHeader, buttonClass, fmtDate } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { NameForm, PasswordForm, PinForm, PreferencesForm } from "./forms";

/** Rough device label from a user-agent string. */
function device(ua: string | null): string {
  if (!ua) return "Unknown device";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${browser} on ${os}`;
}

export type SecurityParams = { linked?: string; error?: string; admin?: string; password?: string };

/**
 * Everything on "You & your security" belongs to the person, not a shop, so it is shared by the page inside the shop app
 * (/settings/security) and the stand-alone one (/account/security) used by people with no shop yet, such as a platform admin.
 */
export async function SecurityView({ sp, user, sid }: { sp: SecurityParams; user: User; sid: string }) {
  // Google can be disconnected only while there is another way back in: a verified email with a password.
  const methods = (user.googleSub ? 1 : 0) + (user.emailVerifiedAt && user.passwordHash ? 1 : 0);
  const admin = isPlatformAdmin(user);
  // The server admin's password lives in PLATFORM_ADMIN_PASSWORD, so the app can't change it.
  const serverAdmin = !!user.email && user.email === serverAdminEmail();
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
          <p className="text-sm text-muted">You sign in with your email and password{googleEnabled() ? ", or with Google" : ""}.</p>
        </div>
        {sp.password === "1" && !user.passwordHash && <p role="alert" className="rounded-lg border border-warn/30 bg-warn/10 px-3 py-2.5 text-sm text-warn">Set a password below. Phone sign-in has been switched off, so you will need your email and password next time.</p>}
        <ul className="divide-y divide-line">
          <li className="space-y-2 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span><span className="block font-medium">Email</span><span className="text-sm text-muted">{user.email ?? "Not added"}</span></span>
              {user.email && user.emailVerifiedAt && <Badge tone="good">Verified</Badge>}
            </div>
            {!(user.email && user.emailVerifiedAt) && <EmailLink />}
          </li>
          <li className="space-y-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="block font-medium">Password</span>
                <span className="text-sm text-muted">{user.passwordHash ? `Set${user.passwordChangedAt ? ` · changed ${fmtDate(user.passwordChangedAt)}` : ""}` : "Not set yet"}</span>
              </span>
              {!user.passwordHash && <Badge tone="warn">Needed</Badge>}
            </div>
            {serverAdmin
              ? <p className="text-sm text-muted">This admin&rsquo;s password is set on the server (PLATFORM_ADMIN_PASSWORD). Change it there and restart.</p>
              : user.email && user.emailVerifiedAt
              ? <PasswordForm hasPassword={!!user.passwordHash} />
              : <p className="text-sm text-muted">Add your email above first, then set a password.</p>}
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2 py-3">
            <span><span className="block font-medium">Mobile number</span><span className="text-sm text-muted">{(user.mobile ?? user.phone) ? `+${user.mobile ?? user.phone}` : "Not added"}</span></span>
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
              {s.id === sid &&<span className="ml-2 rounded bg-brand/10 px-1.5 py-0.5 text-xs text-brand">this device</span>}
              <span className="block text-xs text-muted">
                Signed in {fmtDate(s.createdAt)} · last active {fmtDate(s.lastActiveAt)} {time(s.lastActiveAt)}{s.ip && ` · ${s.ip}`}
              </span>
            </span>
            {s.id !== sid && (
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

      <h2 className="mb-2 mt-8 text-base font-semibold tracking-tight">Your data</h2>
      <Card className="space-y-2 text-sm">
        <p className="text-muted">
          You can download your records any time from <a className="text-brand underline" href="/data">Excel &amp; backup</a>, and read what we keep and why in
          our <a className="text-brand underline" href="/privacy">Privacy Policy</a>.
        </p>
        <p className="text-muted">Don’t want to use {BRAND.NAME} any more? You can delete your account and the data only you own. We explain exactly what happens before anything is done.</p>
        <a href="/account/delete" className={buttonClass("danger")}>Delete my account…</a>
      </Card>
    </>
  );
}
