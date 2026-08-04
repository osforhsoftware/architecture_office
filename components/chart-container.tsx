"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { ResponsiveContainer } from "recharts"

/**
 * Renders Recharts only after the wrapper has a real size.
 * Prevents "width(-1) and height(-1) of chart should be greater than 0" in SSR / early layout.
 */
export function ChartContainer({
  children,
  className,
  width = "100%",
  height,
  minHeight,
}: {
  children: ReactNode
  className?: string
  width?: number | `${number}%`
  height: number | `${number}%`
  minHeight?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const check = () => {
      const { width: w, height: h } = el.getBoundingClientRect()
      setReady(w > 0 && h > 0)
    }

    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const style =
    typeof height === "number"
      ? { height, minHeight: minHeight ?? height }
      : { height, minHeight }

  return (
    <div ref={ref} className={className} style={style}>
      {ready ? (
        <ResponsiveContainer width={width} height="100%" minWidth={0} minHeight={0}>
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  )
}
