import Link from "next/link";
import { LegalPage, Mail, Section } from "@/components/legal-page";
import { getSite } from "@/lib/site-settings";
import { BRAND } from "@/lib/brand";

export const metadata = { title: "Acceptable Use", description: `What is and is not allowed when using ${BRAND.NAME}.` };

export default async function AcceptableUse() {
  const site = await getSite();
  return (
    <LegalPage
      title="Acceptable Use"
      intro={<>{BRAND.NAME} is for honest business records and polite reminders. These rules keep it safe and fair for shops and for their customers. They are part of the <Link className="font-medium text-brand underline" href="/terms">Terms of Use</Link>.</>}
    >
      <Section title="Please do">
        <ul>
          <li>Record real sales, credit and payments accurately.</li>
          <li>Message only people who have agreed to receive account messages from you, and stop when they ask.</li>
          <li>Be polite. A reminder is a request, not a threat.</li>
          <li>Keep your sign-in, OTP codes and PIN private, and give staff only the access they need.</li>
          <li>Tell us if you find a security problem.</li>
        </ul>
      </Section>

      <Section title="Please do not">
        <ul>
          <li>Use the Service for anything illegal, for fraud, money laundering, or evading tax.</li>
          <li>Make false, backdated or misleading bills, or record transactions that did not happen.</li>
          <li>Send spam, unwanted promotions, threats, abuse, or messages meant to shame, frighten or harass anyone, including their family or employer, about money.</li>
          <li>Upload personal data of people you have no right to hold, or someone else’s identity documents, or content that is unlawful, hateful or sexual.</li>
          <li>Try to get into another shop’s data, look for weaknesses without our written permission, overload the Service, scrape it, or use bots.</li>
          <li>Share one account across several shops or people to avoid staff limits or fees.</li>
          <li>Upload viruses or anything meant to damage systems.</li>
          <li>Copy, resell or white-label the Service, or use it to build a competing product.</li>
        </ul>
      </Section>

      <Section title="If something goes wrong">
        <p>We may remove content, limit features or pause an account that breaks these rules, and where the law requires we may report it to the authorities. We try to warn you first when it is safe to do so. If you think we got it wrong, {site.supportEmail ? <>write to <Mail className="font-medium text-brand underline" to={site.supportEmail} /></> : <>use <Link className="font-medium text-brand underline" href="/grievance">Contact &amp; Grievance</Link></>}.</p>
        <p>To report misuse of {BRAND.NAME}, for example a message you received from a shop that you did not agree to, use <Link className="font-medium text-brand underline" href="/grievance">Contact &amp; Grievance</Link>.</p>
      </Section>
    </LegalPage>
  );
}
