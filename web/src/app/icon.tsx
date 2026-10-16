import { ImageResponse } from "next/og";
import { MarkSvg } from "@/lib/brand-mark";

// The small icon in the browser tab.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<MarkSvg size={64} rounded={0.22} />, size);
}
