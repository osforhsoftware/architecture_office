import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"

export function StaffKpiCard({
  label,
  value,
  href,
}: {
  label: string
  value: number
  href: string
}) {
  return (
    <Link href={href} className="block">
      <Card className="shadow-none transition-colors hover:border-primary/40 hover:bg-muted/30">
        <CardContent className="p-3 text-center">
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

export function StaffKpiGrid({
  items,
}: {
  items: { label: string; value: number; href: string }[]
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <StaffKpiCard key={item.label} {...item} />
      ))}
    </div>
  )
}
