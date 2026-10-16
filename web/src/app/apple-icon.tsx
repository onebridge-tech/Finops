import { ImageResponse } from "next/og";
import { MarkSvg } from "@/lib/brand-mark";

// The icon when someone adds the app to an iPhone home screen. iOS rounds the corners itself.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<MarkSvg size={180} rounded={0} inset={0.06} />, size);
}
