import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Coerce DB/driver values to a finite number (handles null, undefined, NaN, strings). */
export function toSafeNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback
  const n = typeof value === "number" ? value : Number.parseFloat(String(value))
  return Number.isFinite(n) ? n : fallback
}
