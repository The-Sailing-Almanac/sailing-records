/**
 * apps/web/src/app/components/Symbol.tsx
 *
 * Renders a named nautical SVG symbol as inline HTML.
 * Backed by apps/web/src/lib/symbols.ts — no external image files.
 *
 * Usage:
 *   <Symbol name="helm" size={32} color="var(--primary)" />
 *   <Symbol name="burgee" size={24} />
 */

import { getSymbol, SymbolName } from "@/lib/symbols";

interface SymbolProps {
  name: SymbolName;
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
  "aria-label"?: string;
}

export default function Symbol({
  name,
  size = 24,
  color = "currentColor",
  className,
  style,
  "aria-label": ariaLabel,
}: SymbolProps) {
  const svgString = getSymbol(name, color, size);

  return (
    <span
      role="img"
      aria-label={ariaLabel ?? `${name} icon`}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        lineHeight: 1,
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: svgString }}
    />
  );
}
