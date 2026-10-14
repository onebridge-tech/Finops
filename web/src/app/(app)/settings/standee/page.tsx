import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { requireBusiness } from "@/lib/auth";
import { upiLink } from "@/lib/share";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Counter standee" };

// Printable A5 counter standee with the static UPI QR (CP-04).
export default async function Standee() {
  const { business } = await requireBusiness();
  if (!business.upiId) notFound();
  const qr = await QRCode.toDataURL(upiLink({ vpa: business.upiId, payee: business.name }), { margin: 1, width: 520 });

  return (
    <>
      <div className="no-print mb-4 flex justify-end"><PrintButton /></div>
      <section className="mx-auto flex max-w-md flex-col items-center rounded-2xl border-4 border-brand bg-white p-8 text-center text-black print:mt-8">
        <p className="text-base font-semibold uppercase tracking-widest text-brand">Scan & pay</p>
        <h1 className="mt-1 text-3xl font-bold">{business.name}</h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="UPI QR code" width={300} height={300} className="my-6" />
        <p className="text-lg font-medium">{business.upiId}</p>
        <p className="mt-3 text-base">Pay with any UPI app: Google Pay · PhonePe · Paytm · BHIM · your bank’s app</p>
        <p className="mt-1 text-base">किसी भी UPI ऐप से भुगतान करें · ఏ UPI యాప్‌తోనైనా చెల్లించండి</p>
      </section>
    </>
  );
}
