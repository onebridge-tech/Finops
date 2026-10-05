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
import { fileUrl } from "@/lib/files";

export const metadata = { title: "Settings" };

export default async function Settings() {
  const { business, role } = await requireBusiness();
  const counterQr = business.upiId
    ? await QRCode.toDataURL(upiLink({ vpa: business.upiId, payee: business.name }), { margin: 1, width: 220 })
    : null;
  const testChannels = (["WHATSAPP", "SMS", "EMAIL"] as const).filter(isTestMode);
  const owner = can(role, "settings:write");

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-4 font-semibold">Business profile</h2>
          {owner ? (
            <BusinessForm action={updateBusiness} values={business} submitLabel="Save changes" />
          ) : (
            <p className="text-sm text-muted">Only the owner or an admin can change these details.</p>
          )}
        </Card>
        <Card className="h-fit text-center">
          <h2 className="font-semibold">Counter QR</h2>
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

        <Card className="lg:col-span-2">
          <h2 className="mb-4 font-semibold">Invoice & quotation branding</h2>
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
        <div className="hidden lg:block" />

        <Card className="lg:col-span-2">
          <h2 className="mb-1 font-semibold">Messages & reminders</h2>
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
        <Card className="h-fit space-y-3">
          <h2 className="font-semibold">Messaging credits</h2>
          <p className="text-3xl font-semibold tabular-nums">{business.creditBalance}</p>
          <p className="text-sm text-muted">1 credit per WhatsApp or SMS message. Email is free.</p>
          <Link href="/settings/credits" className="text-sm font-medium text-brand underline">Buy credits & see usage</Link>
          {owner && <div className="border-t border-line pt-3"><RunRemindersButton /></div>}
        </Card>
        <Card className="h-fit space-y-2 text-sm lg:col-start-3">
          <h2 className="font-semibold">Team & access</h2>
          <ul className="space-y-1">
            {can(role, "team:manage") && <li><Link href="/settings/team" className="font-medium text-brand underline">Team members & roles</Link></li>}
            <li><Link href="/settings/branches" className="font-medium text-brand underline">Branches</Link></li>
            <li><Link href="/settings/security" className="font-medium text-brand underline">App lock & signed-in devices</Link></li>
          </ul>
        </Card>
        <Card className="h-fit space-y-2 text-sm lg:col-start-3">
          <h2 className="font-semibold">Your data</h2>
          <p className="text-muted">Import parties and items from Excel, export any list, download everything, or back up.</p>
          <Link href="/data" className="font-medium text-brand underline">Import & export</Link>
        </Card>
      </div>
    </>
  );
}
