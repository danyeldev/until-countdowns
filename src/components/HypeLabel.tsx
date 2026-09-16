import { formatHypePoints } from "@/lib/hype";

export function HypeLabel({
  points,
  className = "",
}: {
  points?: number;
  className?: string;
}) {
  if (!points) return null;
  return (
    <span className={`hype-chip ${className}`.trim()}>
      {formatHypePoints(points)} hype
    </span>
  );
}
