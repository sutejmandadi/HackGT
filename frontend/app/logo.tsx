import React from "react";

interface MeCodeLogoProps {
  /** Size of the inner SVG icon in pixels (default: 18) */
  size?: number;
  /** Whether to wrap in the sleek tactile dark badge (default: true) */
  badge?: boolean;
  /** Whether to show the "MeCode" brand text next to it (default: false) */
  showName?: boolean;
  /** Optional class name for the container */
  className?: string;
  /** Terminal prompt accent color (defaults to cyan '#38bdf8' or 'currentColor') */
  accentColor?: string;
}

/**
 * MeCode Minimalist Developer Brand Mark:
 * Geometric monoline 'M' integrating a terminal prompt (>_) at its baseline center.
 * Precision-drawn on a 24x24 coordinate grid.
 */
export function MeCodeLogoGlyph({
  size = 18,
  accentColor = "#38bdf8",
  className = "",
}: {
  size?: number;
  accentColor?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Outer Geometric M */}
      <path
        d="M4 19.5V5L12 12.5L20 5V19.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Terminal Prompt Chevron (>) */}
      <path
        d="M8 15.5L10.5 17.5L8 19.5"
        stroke={accentColor}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Terminal Prompt Cursor (_) */}
      <path
        d="M12.5 19.5H16"
        stroke={accentColor}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MeCodeLogo({
  size = 18,
  badge = true,
  showName = false,
  className = "",
  accentColor = "#38bdf8",
}: MeCodeLogoProps) {
  const icon = <MeCodeLogoGlyph size={size} accentColor={accentColor} />;

  if (!badge && !showName) {
    return <span className={className}>{icon}</span>;
  }

  return (
    <span className={`raycast-brand-inline ${className}`.trim()}>
      {badge ? (
        <span className="raycast-logo-box" aria-hidden="true">
          {icon}
        </span>
      ) : (
        icon
      )}
      {showName && <span className="raycast-brand-name">MeCode</span>}
    </span>
  );
}

export default MeCodeLogo;
