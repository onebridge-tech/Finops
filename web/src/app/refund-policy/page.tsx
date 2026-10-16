import Link from "next/link";
import { LegalPage, Mail, Section } from "@/components/legal-page";
import { getSite } from "@/lib/site-settings";
import { BRAND } from "@/lib/brand";

export const metadata = { title: "Refunds & Cancellation", description: `How cancellation and refunds work in ${BRAND.NAME}.` };

export default async function Refunds() {
  const site = await getSite();
  return (
    <LegalPage
      title="Refunds & Cancellation"
      intro={<>Starting with {BRAND.NAME} is free. This page explains what happens if you buy message credits or a paid plan and later want to stop or ask for money back.</>}
    >
      <Section title="1. Free use">
        <p>You can use the free features without paying and stop at any time. There is no contract and no notice period.</p>
      </Section>

      <Section title="2. Message credits">
        <ul>
          <li>Credits are prepaid and are used when SMS messages are sent (one credit per SMS). WhatsApp from your own phone and email do not use credits.</li>
          <li><b>Unused credits</b> can be refunded in full if you ask within 7 days of buying them and have used none of that pack.</li>
          <li><b>Used credits</b> cannot be refunded, because the messages have already been handed to the telecom network.</li>
          <li>Credits do not expire while your account is active. Free “welcome” credits have no cash value and cannot be refunded or transferred.</li>
          <li>If a message was charged but was not handed over because of a fault on our side, we put the credit back.</li>
        </ul>
      </Section>

      <Section title="3. Paid plans (when available)">
        <ul>
          <li>You can cancel a paid plan at any time from the app or by writing to us. It stays active until the end of the period you have paid for, then returns to the free plan. Your records are never deleted because a plan ended.</li>
          <li>If you were charged by mistake or twice, or a charge was made after you cancelled, we refund the extra amount.</li>
          <li>Other plan fees are not refunded for a period that has already started, unless the law says otherwise.</li>
        </ul>
      </Section>

      <Section title="4. Test mode">
        <p>While online payments are shown as “test mode” in the app, no real money is taken and credits added in test mode have no cash value.</p>
      </Section>

      <Section title="5. How to ask for a refund">
        <ol>
          <li>{site.supportEmail ? <>Write to <Mail to={site.supportEmail} /></> : <>Use <Link href="/grievance">Contact &amp; Grievance</Link></>} from the email or phone number on your account, with the date and amount of the payment.</li>
          <li>We reply within {site.replyDaysNum} days. If the refund is approved, it goes back to the original payment method (UPI, card or bank) and normally reaches you in 5 to 10 working days, depending on your bank.</li>
        </ol>
        <p>Payments you make to your own customers or suppliers, or that they make to you, are between you and them. We do not hold that money and cannot refund it.</p>
      </Section>

      <Section title="6. Closing your account">
        <p>You can ask us to delete your shop at any time; see the <Link href="/privacy">Privacy Policy</Link>. Download your records first from <b>Excel &amp; backup</b>. Closing an account does not by itself earn a refund of credits you have already used.</p>
      </Section>

      <Section title="7. Problems">
        <p>If you are not happy with our answer, use <Link href="/grievance">Contact &amp; Grievance</Link>.</p>
      </Section>
    </LegalPage>
  );
}
