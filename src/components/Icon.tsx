import type { SVGProps } from "react";

const paths = {
  arrow: "M4 12h16m-6-6 6 6-6 6",
  search: "m21 21-5-5M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15",
  plus: "M12 5v14M5 12h14",
  clock: "M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  bookmark: "M6 4h12v17l-6-4-6 4V4Z",
  calendar: "M7 2v4m10-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z",
  globe:
    "M2 12h20M12 2a20 20 0 0 1 0 20 20 20 0 0 1 0-20M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  spark: "m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z",
  check: "m5 12 4 4L19 6",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "m6 6 12 12M6 18 18 6",
  grid: "M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z",
  leaf: "M5 19C-2 7 12 2 21 3c1 13-7 19-16 16Zm0 0L16 8",
  chevron: "m6 9 6 6 6-6",
  bolt: "m13 2-9 12h7l-1 8 10-13h-7l1-7Z",
  compass: "m16 8-3 5-5 3 3-5 5-3ZM22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  moon: "M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z",
  arrowLeft: "M20 12H4m6-6-6 6 6 6",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  film: "M4 3h16v18H4V3Zm0 5h16M4 16h16M8 3v18M16 3v18",
  music:
    "M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  trophy:
    "M8 3h8v7a4 4 0 0 1-8 0V3Zm4 11v6m-5 1h10M8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4",
  bell: "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9m4.3 13a1.94 1.94 0 0 0 3.4 0",
  heart: "M12 21s-7-4.35-9.5-8.1C.7 9.9 2.1 6.2 5.6 6.2c2 0 3.5 1.2 6.4 4 2.9-2.8 4.4-4 6.4-4 3.5 0 4.9 3.7 3.1 6.7C19 16.65 12 21 12 21Z",
  send: "M22 2 11 13M22 2l-7 20-4-9-9-4Z",
} as const;

export type IconName = keyof typeof paths;

export function Icon({
  name,
  size = 18,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
