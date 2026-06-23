"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react"
import { cn } from "@/lib/utils"

export function HorizontalScrollArea({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [canScroll, setCanScroll] = useState(false)
  const dragState = useRef({ startX: 0, scrollLeft: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const checkOverflow = () => {
      setCanScroll(el.scrollWidth > el.clientWidth)
    }

    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }

    checkOverflow()
    const observer = new ResizeObserver(checkOverflow)
    observer.observe(el)
    el.addEventListener("wheel", onWheel, { passive: false })

    return () => {
      observer.disconnect()
      el.removeEventListener("wheel", onWheel)
    }
  }, [])

  const onMouseDown = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el || el.scrollWidth <= el.clientWidth) return
    if ((e.target as HTMLElement).closest("a, button, input, textarea, select")) return

    setIsDragging(true)
    dragState.current = { startX: e.clientX, scrollLeft: el.scrollLeft }
  }, [])

  const onMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const el = ref.current
      if (!isDragging || !el) return

      const dx = e.clientX - dragState.current.startX
      el.scrollLeft = dragState.current.scrollLeft - dx
    },
    [isDragging],
  )

  const endDrag = useCallback(() => setIsDragging(false), [])

  return (
    <div
      ref={ref}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      className={cn(
        "no-scrollbar overflow-x-auto",
        canScroll && !isDragging && "cursor-grab",
        isDragging && "cursor-grabbing select-none",
        className,
      )}
    >
      {children}
    </div>
  )
}
