import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"

const LOGO_FULL = "/assets/acmmo_logo_full.png"
const LOGO_ICON = "/assets/acmmo_logo_icon.png"
const LOGO_FULL_WIDTH = 1024
const LOGO_FULL_HEIGHT = 258
const LOGO_ICON_WIDTH = 300
const LOGO_ICON_HEIGHT = 258

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

export function BrandLogo({
  compact = false,
  className,
  priority,
  align = "center",
  variant = "dark",
}: BrandLogoProps) {
  const onLight = variant === "light"

  if (compact) {
    return (
      <Image
        src={LOGO_ICON}
        alt="ACMMO Architects"
        width={LOGO_ICON_WIDTH}
        height={LOGO_ICON_HEIGHT}
        className={cn("h-9 w-auto max-w-full object-contain", className)}
        style={{ aspectRatio: `${LOGO_ICON_WIDTH} / ${LOGO_ICON_HEIGHT}` }}
        priority={priority}
      />
    )
  }

  return (
    <Image
      src={LOGO_FULL}
      alt="ACMMO Architects"
      width={LOGO_FULL_WIDTH}
      height={LOGO_FULL_HEIGHT}
      className={cn(
        "h-9 w-auto max-w-full object-contain sm:h-10 md:h-11",
        !onLight && "invert hue-rotate-180",
        align === "center" && "mx-auto",
        align === "left" && "object-left",
        className,
      )}
      style={{ aspectRatio: `${LOGO_FULL_WIDTH} / ${LOGO_FULL_HEIGHT}` }}
      priority={priority}
    />
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
          className={cn("min-w-0", compact ? "mx-auto w-fit shrink-0" : "w-fit max-w-full shrink")}
        >
          {logo}
        </Link>
      ) : (
        <div className={cn("min-w-0", compact ? "mx-auto w-fit shrink-0" : "w-fit max-w-full shrink")}>
          {logo}
        </div>
      )}
      {children ? <div className="ml-auto shrink-0">{children}</div> : null}
    </div>
  )
}
