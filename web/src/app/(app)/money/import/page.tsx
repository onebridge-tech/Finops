import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { ImportWizard } from "./import-wizard";

export const metadata = { title: "Add a statement" };

export default async function ImportStatement() {
  await requireBusiness("cash:manage");
  return (
    <>
      <PageHeader
        title="Add a statement"
        sub="Bring in your bank or UPI statement to see where your money came from and where it went."
        action={<Link href="/money" className="text-sm text-muted hover:text-ink">← Money in & out</Link>}
      />
      <Card className="mb-5 text-sm">
        <p className="font-medium">How to get the file</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          <li>In your bank’s website or app, open Account statement, choose the month, and download it. <b className="text-ink">Excel or CSV</b> is best; a <b className="text-ink">PDF</b> works too, even one locked with a password.</li>
          <li>A PDF is opened here on your device. It is not uploaded, and its password is never sent or saved.</li>
          <li>PhonePe, Google Pay and Paytm let you export a statement too. Choose the CSV or Excel option if you see one.</li>
          <li>You can add a month at a time. If two statements overlap, nothing is counted twice.</li>
          <li>Want to see what the file should look like? <a className="font-medium text-brand underline" href="/sample-statement.csv" download>Download a sample</a>.</li>
        </ul>
      </Card>
      <ImportWizard />
    </>
  );
}
