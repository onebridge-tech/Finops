import QRCode from "qrcode";
import { can, requireBusiness } from "@/lib/auth";
import { updateBusiness } from "@/app/actions/business";
import { upiLink } from "@/lib/share";
import { BusinessForm } from "@/components/business-form";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Settings" };

export default async function Settings() {
  const { business, role } = await requireBusiness();
  const counterQr = business.upiId
    ? await QRCode.toDataURL(upiLink({ vpa: business.upiId, payee: business.name }), { margin: 1, width: 220 })
    : null;

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-4 font-semibold">Business profile</h2>
          {can(role, "settings:write") ? (
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
            </>
          ) : (
            <p className="text-sm text-muted">Add a UPI ID to generate your QR.</p>
          )}
        </Card>
      </div>
    </>
  );
}
