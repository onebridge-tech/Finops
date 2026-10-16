import Link from "next/link";
import { LegalPage, Section } from "@/components/legal-page";
import { BRAND } from "@/lib/brand";

export const metadata = { title: "Cookies", description: `The cookies and local storage ${BRAND.NAME} uses.` };

const ROWS: [string, string, string][] = [
  ["Sign-in session", "Keeps you signed in on this device. Removed when you sign out or it expires.", "Needed"],
  ["Google sign-in step", "Holds a short-lived value while you sign in with Google, so the sign-in cannot be hijacked. Deleted when sign-in finishes.", "Needed"],
  ["Invite link", "If you arrive through another shop’s invite link, remembers it for up to 30 days so that shop can be credited when you sign up.", "Optional, only if you used an invite link"],
  ["Offline storage on your phone", "Keeps entries you make without signal until they can upload, and keeps the app quick.", "Needed"],
];

export default function Cookies() {
  return (
    <LegalPage
      title="Cookies"
      intro={<>{BRAND.NAME} uses only the cookies and browser storage it needs to work. We do not use advertising cookies, and we do not sell or share what they hold.</>}
    >
      <Section title="What we use">
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full min-w-[460px] text-sm">
            <thead className="text-left text-xs font-medium text-muted"><tr><th className="p-3">What</th><th className="p-3">Why</th><th className="p-3">Type</th></tr></thead>
            <tbody className="divide-y divide-line">
              {ROWS.map(([a, b, c]) => <tr key={a}><td className="p-3 font-medium text-ink">{a}</td><td className="p-3">{b}</td><td className="p-3">{c}</td></tr>)}
            </tbody>
          </table>
        </div>
        <p>Because these are needed for the app to work, they are set without a pop-up. If we ever add analytics or other optional cookies, we will ask first and give you a way to say no.</p>
      </Section>

      <Section title="Third parties">
        <p>If you choose “Continue with Google”, Google sets its own cookies on its sign-in page; Google’s policy applies there. Online payment pages, when used, belong to our payment partner and have their own cookies.</p>
      </Section>

      <Section title="Your choices">
        <p>You can clear cookies and site data in your browser settings at any time. If you do, you will be signed out, and entries that have not yet uploaded from an offline phone can be lost, so upload first. Blocking all cookies will stop sign-in from working.</p>
        <p>More about what data we keep is in the <Link href="/privacy">Privacy Policy</Link>.</p>
      </Section>
    </LegalPage>
  );
}
