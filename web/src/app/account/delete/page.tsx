import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { keepAccount } from "@/app/actions/account";
import { erasesOn, shopsClosingWith } from "@/lib/erase";
import { serverAdminEmail } from "@/lib/platform-auth";
import { getSite } from "@/lib/site-settings";
import { BACKUP_KEEP as BACKUP_DAYS } from "@/lib/backup-keep";
import { Logo } from "@/components/icon";
import { BRAND } from "@/lib/brand";
import { Card, buttonClass, fmtDate } from "@/components/ui";
import { DeleteForm } from "./delete-form";

export const metadata = { title: "Delete your account", robots: { index: false, follow: false } };

// Deleting an account and everything only it owns (Digital Personal Data Protection Act, 2023, s. 12), or, once
// asked, keeping it after all. Stand-alone so it works with no shop, and for an account that is already closed.
export default async function DeleteAccount() {
  const { user } = await requireUser({ closedAccountOk: true });
  const site = await getSite();
  const shops = await shopsClosingWith(user.id);
  const closing = shops.filter((s) => s.closes);
  const staying = shops.filter((s) => !s.closes);
  const serverAdmin = !!user.email && user.email === serverAdminEmail();
  const back = user.deletionRequestedAt ? null : shops.length ? "/settings/security" : "/account/security";
  const contact = site.privacyEmail || site.supportEmail;

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-4 px-4 sm:px-6">
          <span className="flex flex-1 items-center gap-2 font-semibold tracking-tight"><Logo size={28} />{BRAND.NAME}</span>
          {back && <Link href={back} className="text-sm text-muted hover:text-ink">Back</Link>}
          <form action={logout}><button className="text-sm text-muted underline hover:text-gave">Sign out</button></form>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        {user.deletionRequestedAt ? (
          <Scheduled on={await erasesOn(user.deletionRequestedAt)} closing={closing.map((s) => s.name)} contact={contact} />
        ) : (
          <>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Delete your account</h1>
              <p className="mt-1 text-sm text-muted">You can ask us to delete your account and your data at any time. This page explains exactly what happens, so there are no surprises.</p>
            </div>

            {closing.length > 0 && (
              <Card className="space-y-2 border-warn/40">
                <h2 className="font-semibold">First, download your records</h2>
                <p className="text-sm text-muted">
                  Once erased, your shop’s records can’t be brought back, by you or by us. GST law asks businesses to keep their accounts for 72 months,
                  and income-tax law for several years, so keep a copy for yourself. Open each shop and use <b className="text-ink">Excel &amp; backup</b> to download everything.
                </p>
                <Link href="/data" className={buttonClass("secondary")}>Go to Excel &amp; backup</Link>
              </Card>
            )}

            <Card className="space-y-3">
              <h2 className="font-semibold">What happens</h2>
              <ol className="list-decimal space-y-2 pl-5 text-sm">
                <li><b>Straight away</b>, your account is closed. You are signed out on every other phone and computer, and {closing.length ? "the shops listed below close" : "you can no longer open any shop"}. Nobody can sign in to it except you, and only to cancel.</li>
                <li><b>For the next {site.deleteDaysNum} days</b>, nothing is erased yet. If you change your mind, sign in and press <b>Keep my account</b>; everything comes back as it was.</li>
                <li><b>After {site.deleteDaysNum} days</b>, it is erased for good: your name, email, mobile number, password, Google link, app-lock PIN and signed-in devices{closing.length ? ", and everything in the shops below: customers, suppliers, entries, bills, payments, stock, statements, files and settings" : ""}. This can’t be undone.</li>
                <li>Our daily backups that still hold your data are replaced within {BACKUP_DAYS} days after that.</li>
              </ol>
            </Card>

            {shops.length > 0 && (
              <Card className="space-y-2">
                <h2 className="font-semibold">Your shops</h2>
                <ul className="divide-y divide-line text-sm">
                  {closing.map((s) => (
                    <li key={s.id} className="py-2"><span className="font-medium">{s.name}</span>: <span className="text-gave">closes and is erased</span>, because you are its only owner{s.members > 1 ? `. ${s.members - 1} team member${s.members === 2 ? "" : "s"} will lose access too` : ""}.</li>
                  ))}
                  {staying.map((s) => (
                    <li key={s.id} className="py-2"><span className="font-medium">{s.name}</span>: stays open for its other owners. You are only removed from it; its records belong to them.</li>
                  ))}
                </ul>
                {closing.some((s) => s.members > 1) && <p className="text-sm text-muted">To keep a shop going for your team instead, make one of them an owner first (Settings &rarr; Team). Then it stays open without you.</p>}
              </Card>
            )}

            <Card className="space-y-2">
              <h2 className="font-semibold">What we keep, and why</h2>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
                <li>A line in our records saying an account was deleted and when, with no name, email or phone number, so we can show we did what you asked.</li>
                <li>Records of any payments you made to {BRAND.NAME}, for as long as tax law requires us to keep them.</li>
                <li>Messages already delivered to your customers (WhatsApp, SMS, email) stay on their phones. We can’t take those back.</li>
                <li>If another shop on {BRAND.NAME} has you as one of its customers or suppliers, that is their record, not yours. Ask them to remove it.</li>
              </ul>
              <p className="text-sm text-muted">More in our <Link className="text-brand underline" href="/privacy">Privacy Policy</Link>. Questions or complaints: <Link className="text-brand underline" href="/grievance">Contact &amp; Grievance</Link>.</p>
            </Card>

            {serverAdmin ? (
              <Card className="text-sm text-muted">This admin account is set on the server (PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD), so it can’t be deleted here. Remove those settings on the server instead.</Card>
            ) : (
              <DeleteForm hasPassword={!!user.passwordHash} closing={closing.length} days={site.deleteDaysNum} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Scheduled({ on, closing, contact }: { on: Date; closing: string[]; contact: string }) {
  return (
    <Card className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Your account is closed</h1>
        <p className="mt-1 text-sm text-muted">
          You asked us to delete it. It will be erased for good on <b className="text-ink">{fmtDate(on)}</b>
          {closing.length ? <>, together with {closing.length === 1 ? "your shop" : "your shops"} <b className="text-ink">{closing.join(", ")}</b></> : null}.
          Until then nothing is erased, and you can still change your mind.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <form action={keepAccount}><button className={`${buttonClass("primary")} w-full sm:w-auto`}>Keep my account</button></form>
        <form action={logout}><button className={`${buttonClass("secondary")} w-full sm:w-auto`}>Sign out</button></form>
      </div>
      <p className="text-xs text-muted">
        Keeping it opens your account{closing.length ? " and shops" : ""} again exactly as they were. Want it erased sooner, or something else? Write to {contact ? <a className="text-brand underline" href={`mailto:${contact}`}>{contact}</a> : <Link className="text-brand underline" href="/grievance">us</Link>}.
      </p>
    </Card>
  );
}
