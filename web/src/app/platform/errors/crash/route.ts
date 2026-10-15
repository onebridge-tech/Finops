import { requirePlatformAdmin } from "@/lib/platform-auth";

// Throws on purpose so an admin can check that crashes really reach the error list.
export async function GET() {
  await requirePlatformAdmin();
  throw new Error("Test crash started from the platform admin area");
}
