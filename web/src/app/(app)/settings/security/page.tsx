import { requireBusiness } from "@/lib/auth";
import { SecurityView, type SecurityParams } from "./security-view";

export const metadata = { title: "You & your security" };

export default async function Security({ searchParams }: PageProps<"/settings/security">) {
  const { user, session } = await requireBusiness();
  return <SecurityView sp={(await searchParams) as SecurityParams} user={user} sid={session.sid} />;
}
