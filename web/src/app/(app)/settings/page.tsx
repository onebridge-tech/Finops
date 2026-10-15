import Link from "next/link";
import QRCode from "qrcode";
import { can, requireBusiness } from "@/lib/auth";
import { updateBusiness } from "@/app/actions/business";
import { upiLink } from "@/lib/share";
import { isTestMode } from "@/lib/messaging/providers";
import { BusinessForm } from "@/components/business-form";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { MessagingSettingsForm, RunRemindersButton } from "./messaging-form";
import { BrandingForm } from "./branding-form";
import { ControlsForm } from "@/components/controls-form";
import { CatalogueForm } from "@/components/catalogue-form";
import { appUrl } from "@/lib/share";
import { fileUrl } from "@/lib/files";
import { inviteUrl } from "@/lib/referral";
import { db } from "@/lib/db";
import { CopyLink } from "../parties/[id]/reminder";

export const metadata = { title: "Settings" };

const SECTIONS = [["shop", "Your shop"], ["qr", "Counter QR"], ["look", "Bill look"], ["credit", "Credit & summary"], ["catalogue", "Item list"], ["messages", "Messages"], ["credits", "Credits"], ["staff", "Staff & access"], ["data", "Your data"], ["invite", "Invite"]] as const;

export default async function Settings() {
  const { business, role } = await requireBusiness();
  const counterQr = business.upiId
    ? await QRCode.toDataURL(upiLink({ vpa: business.upiId, payee: business.name }), { margin: 1, width: 220 })
    : null;
  const testChannels = (["SMS", "EMAIL"] as const).filter(isTestMode);
  const owner = can(role, "settings:write");
  const [invite, referred, publicItems] = await Promise.all([
    inviteUrl(business.id),
    db.business.count({ where: { referredById: business.id } }),
    db.item.count({ where: { businessId: business.id, isPublic: true, archivedAt: null } }),
  ]);

  return (
    <>
      <PageHeader title="Settings" />
      <div className="lg:flex lg:gap-8">
        <nav aria-label="On this page" className="mb-5 flex gap-1 overflow-x-auto pb-1 lg:sticky lg:top-20 lg:mb-0 lg:w-48 lg:shrink-0 lg:flex-col lg:self-start lg:overflow-visible">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-card hover:text-ink">{label}</a>
          ))}
        </nav>
        <div className="min-w-0 max-w-3xl flex-1 space-y-5">
        <Card id="shop" className="scroll-mt-24 ">
          <h2 className="mb-4 text-base font-semibold tracking-tight">About your shop</h2>
          {owner ? (
            <BusinessForm action={updateBusiness} values={business} submitLabel="Save changes" />
          ) : (
            <p className="text-sm text-muted">Only the owner or an admin can change these details.</p>
          )}
        </Card>
        <Card id="qr" className="scroll-mt-24  text-center">
          <h2 className="mb-4 text-base font-semibold tracking-tight">Counter QR</h2>
          <p className="mb-3 text-sm text-muted">Print and keep at your counter. Any UPI app can pay.</p>
          {counterQr ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={counterQr} alt="UPI QR code" width={220} height={220} className="mx-auto rounded bg-white p-2" />
              <p className="mt-2 font-medium">{business.name}</p>
              <p className="text-sm text-muted">{business.upiId}</p>
              <LinkButton href="/settings/standee" variant="secondary" className="mt-3">Print standee</LinkButton>
            </>
          ) : (
            <p className="text-sm text-muted">Add a UPI ID to generate your QR.</p>
          )}
        </Card>

        <Card id="look" className="scroll-mt-24 ">
          <h2 className="mb-4 text-base font-semibold tracking-tight">Look of your bills and price quotes</h2>
          {owner ? (
            <BrandingForm
              values={{
                brandColor: business.brandColor, docTemplate: business.docTemplate, docTerms: business.docTerms, quotePrefix: business.quotePrefix,
                bankName: business.bankName, bankAccountName: business.bankAccountName, bankAccountNo: business.bankAccountNo, bankIfsc: business.bankIfsc,
                logoUrl: fileUrl(business.logoFileId), signatureUrl: fileUrl(business.signatureFileId),
              }}
            />
          ) : (
            <p className="text-sm text-muted">Only the owner or an admin can change branding.</p>
          )}
        </Card>
        
        <Card id="credit" className="scroll-mt-24 ">
          <h2 className="mb-4 text-base font-semibold tracking-tight">Credit limit & daily summary</h2>
          {owner ? <ControlsForm v={{ creditControl: business.creditControl, creditBlockOverdue: business.creditBlockOverdue, digestFrequency: business.digestFrequency, digestChannel: business.digestChannel }} /> : <p className="text-sm text-muted">Only the owner or an admin can change these.</p>}
        </Card>
        
        <Card id="catalogue" className="scroll-mt-24 ">
          <h2 className="mb-4 text-base font-semibold tracking-tight">Share your item list</h2>
          {owner ? <CatalogueForm enabled={business.catalogEnabled} url={business.catalogToken ? appUrl("/c/" + business.catalogToken) : null} count={publicItems} /> : <p className="text-sm text-muted">Only the owner or an admin can change this.</p>}
        </Card>
        
        <Card id="messages" className="scroll-mt-24 ">
          <h2 className="mb-3 text-base font-semibold tracking-tight">Messages & reminders</h2>
          <div className="mb-4 rounded-lg border border-[#16a34a]/30 bg-[#16a34a]/10 px-3 py-2.5 text-sm">
            <p className="font-medium">WhatsApp works from your own phone. No WhatsApp Business API needed.</p>
            <p className="mt-0.5 text-muted">Reminders, receipts and bills are written from your templates and wait in your <Link href="/outbox" className="font-medium text-brand underline">WhatsApp outbox</Link>. You tap Send, WhatsApp opens with the words ready, and you press send there. It costs nothing.</p>
            {owner && <Link href="/settings/templates" className="mt-1.5 inline-block font-medium text-brand underline">Change the wording of your messages</Link>}
          </div>
          {testChannels.length > 0 && (
            <p className="mb-4 rounded-lg bg-brand/10 px-3 py-2 text-xs">
              Test mode for {testChannels.map((c) => ({ WHATSAPP: "WhatsApp", SMS: "SMS", EMAIL: "email" })[c]).join(", ")}: messages are recorded and marked delivered but not actually sent. Add provider keys to send for real.
            </p>
          )}
          {owner ? (
            <MessagingSettingsForm
              values={{
                reminderEnabled: business.reminderEnabled, daysBefore: business.reminderDaysBefore, onDue: business.reminderOnDue,
                everyDaysAfter: business.reminderEveryDaysAfter, channel: business.reminderChannel,
                autoReceipt: business.autoReceipt, entryConfirm: business.entryConfirm,
              }}
            />
          ) : (
            <p className="text-sm text-muted">Only the owner or an admin can change these settings.</p>
          )}
        </Card>
        <Card id="credits" className="scroll-mt-24 space-y-3">
          <h2 className="mb-4 text-base font-semibold tracking-tight">Message credits</h2>
          <p className="text-3xl font-semibold tabular-nums">{business.creditBalance}</p>
          <p className="text-sm text-muted">1 credit per SMS. WhatsApp and email are free.</p>
          <Link href="/settings/credits" className="text-sm font-medium text-brand underline">Buy credits & see usage</Link>
          {owner && <div className="border-t border-line pt-3"><RunRemindersButton /></div>}
        </Card>
        <Card id="staff" className="scroll-mt-24 space-y-2 text-sm">
          <h2 className="mb-4 text-base font-semibold tracking-tight">Staff & access</h2>
          <ul className="space-y-1">
            {can(role, "team:manage") && <li><Link href="/settings/team" className="font-medium text-brand underline">Your staff and what they can do</Link></li>}
            <li><Link href="/settings/branches" className="font-medium text-brand underline">Shop branches</Link></li>
            <li><Link href="/settings/security" className="font-medium text-brand underline">Your name, language, lock & devices</Link></li>
            {can(role, "reports:view") && <li><Link href="/settings/audit" className="font-medium text-brand underline">Who changed what</Link></li>}
          </ul>
        </Card>
        <Card id="data" className="scroll-mt-24 space-y-2 text-sm">
          <h2 className="mb-4 text-base font-semibold tracking-tight">Your data</h2>
          <p className="text-muted">Bring your customers and items from Excel, download any list, or keep a backup of everything.</p>
          <Link href="/data" className="font-medium text-brand underline">Excel & backup</Link>
        </Card>
        <Card id="invite" className="scroll-mt-24 space-y-2 text-sm">
          <h2 className="mb-4 text-base font-semibold tracking-tight">Invite other shops</h2>
          <p className="text-muted">Your link is on every statement, invoice and receipt you share. Businesses that join through it: <span className="font-semibold text-ink">{referred}</span></p>
          <p className="break-all rounded bg-bg px-2 py-1 font-mono text-xs">{invite}</p>
          <CopyLink url={invite} label="Copy invite link" />
        </Card>
        </div>
      </div>
    </>
  );
}
