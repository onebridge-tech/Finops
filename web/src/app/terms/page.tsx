import Link from "next/link";
import { LegalPage, Mail, Section } from "@/components/legal-page";
import { getSite } from "@/lib/site-settings";
import { LEGAL } from "@/lib/legal";
import { BRAND } from "@/lib/brand";

export const metadata = { title: "Terms of Use", description: `The rules for using ${BRAND.NAME}.` };

export default async function Terms() {
  const site = await getSite();
  const C = site.company || BRAND.NAME;
  return (
    <LegalPage
      title="Terms of Use"
      intro={<>These are the rules for using {BRAND.NAME}. By signing in or using the app you agree to them. If you do not agree, please do not use it. {site.supportEmail ? <>Questions? Write to <Mail className="font-medium text-brand underline" to={site.supportEmail} />.</> : <>Questions? See <Link className="font-medium text-brand underline" href="/grievance">Contact &amp; Grievance</Link>.</>}</>}
    >
      <Section title="1. Who we are and what FinOps is">
        <p>{BRAND.NAME} (“the Service”) is a web app run by {C} (“we”, “us”) at {LEGAL.SITE}. It helps a shop write down credit given and payments received, make GST bills, send reminders, keep stock, and see money in and out.</p>
        <p>The Service is a record-keeping tool. We are not your accountant, tax adviser, bank or lender, and we do not collect money from your customers for you.</p>
      </Section>

      <Section title="2. Who can use it">
        <ul>
          <li>You must be at least 18 years old and able to enter into a contract under Indian law.</li>
          <li>You use the Service for a business, shop or profession, not for personal household use only.</li>
          <li>If you sign up for a company or firm, you promise that you are allowed to bind it to these Terms.</li>
        </ul>
      </Section>

      <Section title="3. Your account">
        <ul>
          <li>You sign in with a mobile number, an email address or Google. Keep your phone, email and any app-lock PIN safe. Everything done from your account is treated as done by you.</li>
          <li>Give correct details. Tell us at once if you think someone else is using your account.</li>
          <li>The first person to create a shop is its <b>owner</b>. The owner can add staff and choose what each person can see and do, and is responsible for what those people do.</li>
          <li>We may send you one-time codes (OTP) by SMS, email or WhatsApp to sign you in. Standard message charges from your operator may apply.</li>
        </ul>
      </Section>

      <Section title="4. Your data stays yours">
        <p>You own the information you put into the Service, such as customers, entries, bills, items, photos and files (“Your Data”). You give us permission to store, process and show it only so that we can run the Service for you, keep it safe, and meet our legal duties. We do not sell Your Data.</p>
        <p>You are responsible for Your Data being correct and lawful, and for having the right to enter your customers’ and suppliers’ details (see section 6).</p>
        <p>You can download Your Data at any time from <b>Excel &amp; backup</b>. Our <Link href="/privacy">Privacy Policy</Link> explains how we handle personal data.</p>
      </Section>

      <Section title="5. Bills, GST and accounts">
        <ul>
          <li>You are responsible for the GST rates, HSN/SAC codes, place of supply, prices and totals on every bill you make, and for filing your own returns. The app helps with the arithmetic, but it can be wrong if the information you enter is wrong.</li>
          <li>Reports such as “Profit &amp; loss” and “Money in &amp; out” are quick guides for decisions. They are not audited statements and are not advice for tax, audit or legal purposes. Ask your chartered accountant before relying on them.</li>
          <li>Once a bill is issued, the app keeps a record of changes. You must not use the Service to hide, backdate or falsify transactions.</li>
        </ul>
      </Section>

      <Section title="6. Messages to your customers">
        <ul>
          <li>You decide whom to message and what to say. WhatsApp messages are opened on your own phone and sent by you; SMS and email can be sent by the Service if you turn them on.</li>
          <li>Only message people who have agreed to receive account messages from you (reminders, receipts, bills), and stop when they ask. The app records consent and lets people stop messages; you must respect that.</li>
          <li>Follow the rules of WhatsApp, telecom regulators (including TRAI) and the law. Do not send spam, threats or abusive reminders, and do not shame or harass anyone about money. See <Link href="/acceptable-use">Acceptable Use</Link>.</li>
          <li>As far as your customers’ personal data goes, <b>you</b> decide why and how it is used, and we process it on your behalf.</li>
        </ul>
      </Section>

      <Section title="7. Credits, plans and payments">
        <p>Some features, such as SMS, use prepaid message credits. WhatsApp from your own phone and email are free. Prices, plans and offers shown in the app are in Indian rupees and may change; a change does not affect credits you have already bought. Taxes are added where the law requires. How refunds work is explained in <Link href="/refund-policy">Refunds &amp; Cancellation</Link>.</p>
        <p>Payment links and the “Pay online” button, where available, are handled by a licensed payment partner. We do not store card or bank details.</p>
      </Section>

      <Section title="8. What you must not do">
        <p>Follow our <Link href="/acceptable-use">Acceptable Use</Link> rules. In short: no illegal, fraudulent or harmful use; no breaking into, overloading or copying the Service; no sharing your account in a way that gets around staff roles or limits.</p>
      </Section>

      <Section title="9. Our rights in the Service">
        <p>The Service, its design, name, logo and software belong to {C} or its licensors. You get a limited, personal, non-transferable permission to use it under these Terms. You may not copy, resell, reverse-engineer or build a competing service from it.</p>
        <p>If you send us ideas or feedback, we may use them without paying you or crediting you.</p>
      </Section>

      <Section title="10. Availability and changes">
        <ul>
          <li>We work to keep the Service running, but we cannot promise it will always be available or error-free. It may be paused for maintenance, outages of our hosting or message providers, or events outside our control.</li>
          <li>Some features work offline and upload later. Entries not yet uploaded can be lost if your phone is reset or its data is cleared. Keep your own backup.</li>
          <li>We may add, change or remove features. If a change affects you in a major way, we will tell you in the app or by message.</li>
        </ul>
      </Section>

      <Section title="11. Suspension and ending">
        <ul>
          <li>You can stop using the Service at any time and ask us to delete your shop (see the <Link href="/privacy">Privacy Policy</Link>).</li>
          <li>We may pause or end an account if you break these Terms, if the law requires it, if payments are unpaid, or to protect other people or the Service. Where possible we will tell you why and give you time to download Your Data, except where this would be unsafe or unlawful.</li>
          <li>While a shop is paused, its records are kept safe and are not deleted.</li>
        </ul>
      </Section>

      <Section title="12. Our responsibility">
        <ul>
          <li>The Service is provided “as is”. To the extent the law allows, we do not promise that it is free of errors or suits your particular purpose.</li>
          <li>We are not responsible for loss that comes from your wrong entries, your staff’s actions, a customer not paying, third-party services (WhatsApp, telecom, banks, payment partners, Google), or events outside our reasonable control.</li>
          <li>We are not liable for indirect loss, loss of profit, or loss of goodwill. Our total liability for any claim about the Service is limited to the amount you paid us in the 12 months before the claim, or ₹5,000 if you paid nothing.</li>
          <li>Nothing here limits liability that cannot be limited under Indian law.</li>
        </ul>
      </Section>

      <Section title="13. You protect us too">
        <p>If someone makes a claim against us because of Your Data, your messages to customers, or your breach of these Terms or the law, you agree to cover our reasonable costs of dealing with it.</p>
      </Section>

      <Section title="14. Changes to these Terms">
        <p>We may update these Terms. We will change the date at the top and, for important changes, tell you in the app. If you keep using the Service after a change takes effect, you accept the new Terms.</p>
      </Section>

      <Section title="15. Law and disputes">
        <p>These Terms are governed by the laws of India. Please write to us first{site.grievanceEmail ? <> at <Mail to={site.grievanceEmail} /></> : <> through <Link href="/grievance">Contact &amp; Grievance</Link></>} and give us {site.replyDaysNum} days to put things right. If we cannot settle it, {site.courtCity ? `the courts at ${site.courtCity}` : "the courts in India that have jurisdiction"} will decide, subject to any right you have under consumer law.</p>
      </Section>

      <Section title="16. Contact">
        <p>{C}{site.address ? `, ${site.address}` : ""}.{site.supportEmail ? <> Email <Mail to={site.supportEmail} />.</> : null} See also <Link href="/grievance">Contact &amp; Grievance</Link>.</p>
      </Section>
    </LegalPage>
  );
}
