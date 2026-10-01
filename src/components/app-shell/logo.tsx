import { cn } from "@/lib/utils";

export interface LogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  variant?: "monogram" | "seal";
  withTile?: boolean;
}

export function LogoMark({
  size = 24,
  variant = "monogram",
  withTile = true,
  className,
  ...props
}: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
      {...props}
    >
      {withTile && (
        <rect width="32" height="32" rx="7" fill="var(--primary)" />
      )}
      {variant === "monogram" ? (
        <>
          {/* Circular Monogram "C" (Cert) */}
          <path
            d="M22 11C20.4 8.5 17.6 7 14.5 7C9.8 7 6 11 6 16C6 21 9.8 25 14.5 25C17.6 25 20.4 23.5 22 21"
            stroke={withTile ? "var(--card)" : "var(--primary)"}
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          {/* Verified Checkmark (Tracker) */}
          <path
            d="M12 16L15 19L24.5 9.5"
            stroke={withTile ? "var(--accent)" : "var(--primary)"}
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          {/* Certificate Ribbon tails */}
          <path
            d="M12 20.5L9.5 26.5L13.5 25L15 20.5"
            fill={withTile ? "var(--accent)" : "var(--muted-foreground)"}
          />
          <path
            d="M20 20.5L22.5 26.5L18.5 25L17 20.5"
            fill={withTile ? "var(--accent)" : "var(--muted-foreground)"}
          />
          {/* Rosette seal medal */}
          <circle
            cx="16"
            cy="13.5"
            r="7.5"
            fill={withTile ? "var(--card)" : "var(--primary)"}
          />
          {/* Verification checkmark */}
          <path
            d="M12.5 13.5L15 16L19.5 11"
            stroke={withTile ? "var(--primary)" : "var(--card)"}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}

export function Logo({
  size = 24,
  variant = "monogram",
  withTile = true,
  showText = false,
  className,
}: LogoProps & { showText?: boolean }) {
  if (!showText) {
    return <LogoMark size={size} variant={variant} withTile={withTile} className={className} />;
  }

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark size={size} variant={variant} withTile={withTile} />
      <span className="font-semibold text-section-title tracking-tight text-foreground">
        Cert<span className="text-primary">Tracker</span>
      </span>
    </div>
  );
}
