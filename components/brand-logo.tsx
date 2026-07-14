import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"

const LOGO_ICON = "/assets/fav_acmmo.png"
const BRAND_NAME = "Acmmo Architects"
/** Matches the cyan in the Acmmo brand assets */
const BRAND_ACCENT = "#2ec4d6"

type BrandLogoProps = {
  /** Tighter sizing for collapsed sidebar — shows icon only */
  compact?: boolean
  className?: string
  priority?: boolean
  /** Sidebar: left; login / hero: center */
  align?: "left" | "center"
  /** dark = sidebar / dark surfaces; light = white background */
  variant?: "dark" | "light"
}

function BrandMark({
  compact,
  variant,
  className,
  priority,
}: Pick<BrandLogoProps, "compact" | "variant" | "className" | "priority">) {
  const onLight = variant === "light"

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden",
        compact ? "size-9" : "size-11",
        onLight ? "rounded-lg bg-black p-1" : "rounded-md",
        className,
      )}
    >
      <Image
        src={LOGO_ICON}
        alt=""
        aria-hidden
        width={192}
        height={192}
        className={cn(
          "size-full object-contain",
          !onLight && "mix-blend-lighten",
        )}
        priority={priority}
      />
    </div>
  )
}

function BrandWordmark({
  variant = "dark",
  className,
}: {
  variant?: "dark" | "light"
  className?: string
}) {
  const onLight = variant === "light"

  return (
    <div className={cn("min-w-0 leading-none", className)}>
      <span
        className="block text-[0.95rem] font-bold tracking-[0.22em]"
        style={{ color: BRAND_ACCENT }}
      >
        ACMMO
      </span>
      <span
        className={cn(
          "mt-1 block text-[0.62rem] font-semibold tracking-[0.32em]",
          onLight ? "text-muted-foreground" : "text-sidebar-foreground/80",
        )}
      >
        ARCHITECTS
      </span>
    </div>
  )
}

export function BrandLogo({
  compact = false,
  className,
  priority,
  align = "center",
  variant = "dark",
}: BrandLogoProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5",
        align === "center" && "justify-center",
        align === "left" && "justify-start",
        className,
      )}
    >
      <BrandMark compact={compact} variant={variant} priority={priority} />
      {!compact && <BrandWordmark variant={variant} />}
    </div>
  )
}

export function BrandLogoHeader({
  href,
  compact = false,
  className,
  children,
  align = "left",
  variant = "dark",
}: {
  href?: string
  compact?: boolean
  className?: string
  children?: React.ReactNode
  align?: "left" | "center"
  variant?: "dark" | "light"
}) {
  const logo = <BrandLogo compact={compact} priority align={align} variant={variant} />

  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-border/60",
        variant === "light" ? "bg-white" : "bg-transparent",
        compact ? "justify-center px-2 py-3" : "px-4 py-4",
        className,
      )}
    >
      {href ? (
        <Link
          href={href}
          className={cn("w-fit shrink-0", compact && "mx-auto")}
        >
          {logo}
        </Link>
      ) : (
        <div className={cn("w-fit shrink-0", compact && "mx-auto")}>{logo}</div>
      )}
      {children ? <div className="ml-auto shrink-0">{children}</div> : null}
    </div>
  )
}

export { BRAND_NAME, LOGO_ICON }
