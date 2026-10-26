import Link from "next/link";
import { LegalPage, Mail, Section } from "@/components/legal-page";
import { getSite } from "@/lib/site-settings";
import { BRAND } from "@/lib/brand";
import { BACKUP_KEEP as BACKUP_DAYS } from "@/lib/backup-keep";

export const metadata = { title: "Privacy Policy", description: `How ${BRAND.NAME} collects, uses and protects personal data.` };

export default async function Privacy() {
  const site = await getSite();
  const C = site.company || BRAND.NAME;
  return (
    <LegalPage
      title="Privacy Policy"
      intro={<>This page explains what information {BRAND.NAME} keeps, why, who can see it, and what choices you have. We follow the Digital Personal Data Protection Act, 2023, the Information Technology Act, 2000 and the rules under them. We have tried to use plain words.</>}
    >
      <Section title="1. Two kinds of people">
        <ul>
          <li><b>Shop users</b>: the owner and staff who sign in to FinOps. For your own sign-in details, {C} decides how the data is used.</li>
          <li><b>Your customers and suppliers</b>: people whose names and numbers a shop writes into FinOps. For them, the <b>shop</b> decides why their data is used, and {C} only stores and processes it on the shop’s behalf. If you are a customer and want something changed or removed, please first ask the shop; you can also write to us.</li>
        </ul>
      </Section>

      <Section title="2. What we collect">
        <p><b>When you sign up and sign in</b></p>
        <ul>
          <li>Name, email address, mobile number, and a password (stored only as a one-way scrambled hash, never readable by us), or Google if you choose it. If you use Google, we receive your name, email and a Google account identifier, and nothing else from your Google account.</li>
          <li>An app-lock PIN, stored only as a one-way scrambled value, never as the PIN itself.</li>
          <li>Device and browser details, the time of sign-in and a rough network identifier, so we can show your signed-in devices and protect against misuse.</li>
        </ul>
        <p><b>What you put into the app</b></p>
        <ul>
          <li>Shop details: name, address, GSTIN, UPI ID, bank details you choose to print on bills, logo and signature.</li>
          <li>Customers and suppliers: name, mobile number, email, address, GSTIN, credit terms, notes, and whether they agreed to receive messages.</li>
          <li>Money records: credit given, payments, bills, quotes, orders, items, stock, expenses, cash book and attachments such as bill photos, PDFs and voice notes.</li>
          <li>Bank or UPI statements you add for “Money in &amp; out”: dates, amounts, descriptions, names of payers and payees, and balances, read from the file. The statement file itself is not kept. A <b>PDF statement is opened on your own device</b>: the PDF is never uploaded to us, and if it is locked, the password you type is used only to open it there. It is never sent to us or saved anywhere. Only the transactions you check and add reach us.</li>
          <li>Photos of paper notes that you upload to be read, and the lines read from them.</li>
          <li>Field work, if you use it: visits, check-in times and, only if your phone allows it and you start a visit, the location where you checked in.</li>
        </ul>
        <p><b>Created while you use the app</b></p>
        <ul>
          <li>A record of changes (who changed what and when), the messages queued or sent, and error and performance logs. Error logs are cleaned so that they do not keep personal details.</li>
        </ul>
      </Section>

      <Section title="3. Why we use it">
        <ul>
          <li>To run the Service: sign you in, keep your records, make bills, work out balances, send the messages you ask for, and show reports.</li>
          <li>To keep things safe: stop misuse, find faults, keep a tamper-evident history, and make backups.</li>
          <li>To support you: answer questions and fix problems you report.</li>
          <li>To follow the law and protect our rights.</li>
          <li>To improve the Service, using counts and averages that do not identify a person.</li>
        </ul>
        <p>We do <b>not</b> sell personal data, and we do not use it to show you third-party advertising.</p>
      </Section>

      <Section title="4. Your consent and other lawful grounds">
        <p>We use your data because you ask us to provide the Service and have agreed to these terms, to meet legal duties (for example tax and accounting record rules), and for limited legitimate uses such as security. Where the law needs your specific consent, we ask for it, and you can withdraw it at any time; withdrawing may mean some features can no longer work.</p>
        <p>For messages to your customers (reminders, receipts, bills), the app records whether the customer agreed. Customers can stop messages through the link in each message or by asking the shop.</p>
      </Section>

      <Section title="5. Who we share it with">
        <p>Only as needed to run the Service, and always under confidentiality and security terms:</p>
        <ul>
          <li><b>Hosting and database providers</b> that store and process data for us.</li>
          <li><b>Message providers</b> for SMS, email and verification-code delivery, when you use those features. WhatsApp reminders are opened on your own phone and sent through your own WhatsApp account; WhatsApp’s own privacy policy applies to that.</li>
          <li><b>An AI reading service</b>, only when you use “Paper notes”: the photo you upload is sent to it so it can be read, and is not used by us for anything else. Please do not photograph pages that have other people’s personal details if you do not want that.</li>
          <li><b>Google</b>, if you choose to sign in with it.</li>
          <li><b>Payment partners</b>, if you use online payment links, so that payments can be taken and matched.</li>
          <li><b>Your shop</b>: owners and staff see what their role allows. A customer who opens a statement link sees only their own account with that shop.</li>
          <li><b>Authorities</b>, where the law, a court or a lawful order requires it.</li>
          <li>A buyer, if our business is sold or merged, on the same terms as this policy.</li>
        </ul>
        <p>Some of these providers may keep data on servers outside India. When that happens we take steps to protect it as the law requires.</p>
      </Section>

      <Section title="6. How long we keep it">
        <ul>
          <li>While your shop is active, we keep your records so the app can work.</li>
          <li><b>You can delete your account yourself</b>, any time: <b>Security &amp; sign-in → Delete my account</b>. The page explains what will happen before anything is done. Your account closes straight away and you are signed out everywhere; it is permanently erased {site.deleteDaysNum} days later, together with every shop of which you are the only owner. Until then you can change your mind by signing in and choosing “Keep my account”. A shop that has other owners stays with them; you are only removed from it.</li>
          <li>You can also ask us in writing to delete your account or your shop. We do the same within {site.deleteDaysNum} days of confirming the request is yours.</li>
          <li>Our daily backups that still contain erased data are replaced within {BACKUP_DAYS} days after it is erased.</li>
          <li>After erasure we keep only a note that an account was deleted and when, without your name, email or phone number, so we can show the request was carried out, and records of payments you made to us for as long as tax law requires.</li>
          <li>Some records may have to be kept for the period tax and company laws require (for example, GST records for several years). We keep only what is needed and only for that purpose.</li>
          <li>Verification codes expire within 10 minutes. Security and error logs are kept for a limited time.</li>
        </ul>
      </Section>

      <Section title="7. How we protect it">
        <ul>
          <li>Connections to the Service are encrypted. Passwords and PINs are stored only as salted one-way hashes; repeated wrong attempts are slowed down and blocked for a while.</li>
          <li>Each shop’s data is kept separate, and staff roles limit what each person can see.</li>
          <li>The record of changes is chained so that edits to history can be detected. Backups can be encrypted.</li>
          <li>Our own access to customer data is limited to what is needed for support and safety, and is logged.</li>
        </ul>
        <p>No system is perfectly secure. If a personal data breach affects you, we will tell you and the authorities as the law requires.</p>
      </Section>

      <Section title="8. Your rights">
        <p>Under the DPDP Act you can ask us to:</p>
        <ul>
          <li>tell you what personal data we hold about you and how it is used;</li>
          <li>correct or complete it;</li>
          <li>erase it, when it is no longer needed and the law does not require us to keep it. You can do this yourself with <b>Delete my account</b> (see section 6);</li>
          <li>withdraw a consent you gave, as easily as you gave it (for example, a customer can stop messages with one tap);</li>
          <li>take up a complaint about how it is handled; and</li>
          <li>name someone to exercise these rights for you if you cannot.</li>
        </ul>
        <p>Wherever the app asks for personal details, a short “Why we ask” note next to the form says why it is needed, how long it is kept and who sees it. Shop users can see and fix most of this inside the app and download everything from <b>Excel &amp; backup</b>. For anything else {site.privacyEmail ? <>write to <Mail to={site.privacyEmail} /></> : <>use <Link href="/grievance">Contact &amp; Grievance</Link></>}. We may need to check who you are first. We reply within {site.replyDaysNum} days. If you are unhappy with the answer, you can go to the Data Protection Board of India once it is in place.</p>
      </Section>

      <Section title="9. Children">
        <p>The Service is for businesses and is not meant for people under 18. We do not knowingly collect data about children. If you think we have, tell us and we will remove it.</p>
      </Section>

      <Section title="10. Cookies and similar storage">
        <p>We use a small number of cookies and local storage to keep you signed in and to make the app work offline. See <Link href="/cookies">Cookies</Link>.</p>
      </Section>

      <Section title="11. Changes">
        <p>If we change this policy we will update the date above and, for important changes, tell you in the app.</p>
      </Section>

      <Section title="12. Contact">
        <p>{C}{site.address ? `, ${site.address}` : ""}.{site.privacyEmail ? <> Privacy questions: <Mail to={site.privacyEmail} />.</> : null} Complaints: <Link href="/grievance">Contact &amp; Grievance</Link>.</p>
      </Section>
    </LegalPage>
  );
}
