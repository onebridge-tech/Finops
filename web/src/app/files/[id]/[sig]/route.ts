import { db } from "@/lib/db";
import { getObject, verifyFileSignature } from "@/lib/files";

// Serves uploaded files by signed link (see fileUrl).
export async function GET(_req: Request, ctx: RouteContext<"/files/[id]/[sig]">) {
  const { id, sig } = await ctx.params;
  if (!verifyFileSignature(id, sig)) return new Response("Not found", { status: 404 });
  const file = await db.storedFile.findUnique({ where: { id } });
  if (!file) return new Response("Not found", { status: 404 });
  const bytes = await getObject(file.storageKey);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.name)}"`,
      "Cache-Control": "private, max-age=86400, immutable",
      // Only sniffed images, PDFs and audio are ever stored, never HTML or SVG.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
