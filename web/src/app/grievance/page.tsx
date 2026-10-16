import Link from "next/link";
import { LegalPage, Section } from "@/components/legal-page";
import { BRAND } from "@/lib/brand";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Contact & Grievance", description: `How to reach ${BRAND.NAME} and make a complaint.` };

export default function Grievance() {
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex flex-col gap-0.5 border-b border-line py-3 last:border-0 sm:flex-row sm:gap-6"><dt className="w-48 shrink-0 text-sm font-medium text-ink">{label}</dt><dd className="text-muted">{value}</dd></div>
  );
  return (
    <LegalPage
      title="Contact & Grievance"
      intro={<>Need help, want to use your data rights, or have a complaint? Start here. We read every message and reply within {LEGAL.REPLY_DAYS} days.</>}
    >
      <Section title="Contact us">
        <dl className="rounded-xl border border-line bg-card px-4">
          {row("Company", LEGAL.COMPANY)}
          {row("Address", LEGAL.ADDRESS)}
          {row("Website", <a className="font-medium text-brand underline" href={LEGAL.SITE}>{LEGAL.SITE.replace("https://", "")}</a>)}
          {row("Help and support", <a className="font-medium text-brand underline" href={`mailto:${LEGAL.SUPPORT_EMAIL}`}>{LEGAL.SUPPORT_EMAIL}</a>)}
          {row("Privacy and data requests", <a className="font-medium text-brand underline" href={`mailto:${LEGAL.PRIVACY_EMAIL}`}>{LEGAL.PRIVACY_EMAIL}</a>)}
        </dl>
      </Section>

      <Section title="Grievance Officer">
        <p>As required by the Information Technology Act, 2000, the IT Rules, 2021 and the Digital Personal Data Protection Act, 2023, our Grievance Officer is:</p>
        <dl className="rounded-xl border border-line bg-card px-4">
          {row("Name", LEGAL.GRIEVANCE_OFFICER)}
          {row("Email", <a className="font-medium text-brand underline" href={`mailto:${LEGAL.GRIEVANCE_EMAIL}`}>{LEGAL.GRIEVANCE_EMAIL}</a>)}
          {row("Postal address", LEGAL.ADDRESS)}
          {row("We reply within", `${LEGAL.REPLY_DAYS} days`)}
        </dl>
      </Section>

      <Section title="What to put in your message">
        <ul>
          <li>Your name and the mobile number or email on the account.</li>
          <li>What happened, when, and which screen or message it relates to. A screenshot helps.</li>
          <li>What you would like us to do.</li>
          <li>For a data request: whether you want to see, correct or delete data. We may ask you to prove it is you before we act.</li>
        </ul>
      </Section>

      <Section title="Delete my data">
        <p>To close your shop and erase its data, write to <a className="font-medium text-brand underline" href={`mailto:${LEGAL.PRIVACY_EMAIL}`}>{LEGAL.PRIVACY_EMAIL}</a> from the email or phone number on the account with the subject “Delete my FinOps data”. Download your records first from <b>Excel &amp; backup</b>. We finish within {LEGAL.DELETE_GRACE_DAYS} days of confirming that the request is yours. What we may have to keep by law is explained in the <Link className="font-medium text-brand underline" href="/privacy">Privacy Policy</Link>.</p>
      </Section>

      <Section title="You are a customer of a shop that uses FinOps">
        <p>If you got a reminder or bill and want it to stop, tap “Stop messages” in the message, or tell the shop. If the shop does not help, write to us and we will pass it on and, where the shop is in breach, act on it.</p>
      </Section>

      <Section title="If you are not satisfied">
        <p>If we do not answer within {LEGAL.REPLY_DAYS} days, or you are not happy with the answer, you can complain to the Data Protection Board of India, or approach a consumer commission or court as the law allows.</p>
      </Section>
    </LegalPage>
  );
}
