import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"

const LOGO_DARK = "/assets/osforh-logo-light.png"
const LOGO_LIGHT = "/assets/osforh-logo-white.png"

type BrandLogoProps = {
  /** Tighter sizing for collapsed sidebar */
  compact?: boolean
  className?: string
  priority?: boolean
  /** Sidebar: left; login / hero: center */
  align?: "left" | "center"
  /** dark = transparent (dark surfaces); light = white background */
  variant?: "dark" | "light"
}

export function BrandLogo({
  compact = false,
  className,
  priority,
  align = "center",
  variant = "dark",
}: BrandLogoProps) {
  return (
    <Image
      src={variant === "light" ? LOGO_LIGHT : LOGO_DARK}
      alt="ORIZEN"
      width={220}
      height={72}
      className={cn(
        "h-auto w-full object-contain",
        align === "left" ? "object-left" : "object-center",
        compact ? "max-h-9" : "max-h-14",
        variant === "light" && "rounded-lg",
        className,
      )}
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
        compact ? "px-2 py-3" : "px-4 py-4",
        className,
      )}
    >
      {href ? (
        <Link href={href} className="min-w-0 flex-1">
          {logo}
        </Link>
      ) : (
        <div className="min-w-0 flex-1">{logo}</div>
      )}
      {children}
    </div>
  )
}
