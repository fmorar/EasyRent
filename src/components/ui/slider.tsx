"use client"

import * as React from "react"
import { Slider as SliderPrimitive } from "@base-ui/react/slider"
import { cn } from "@/lib/utils"

/**
 * Range / single-value slider built on Base UI primitives.
 *
 *   <Slider min={0} max={1000000} step={1000} value={[100000, 500000]} ... />
 *
 * - Pass an array to `value` for a range slider (renders 2 thumbs).
 * - Pass a number for a single-value slider.
 * - All Base UI primitives are exposed via `Slider.*` if you need
 *   custom internals; this default export wires up a sensible look.
 */
function Slider({
  className,
  value,
  onValueChange,
  onValueCommitted,
  min      = 0,
  max      = 100,
  step     = 1,
  disabled,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  // If `value` is an array we render N thumbs (one per entry).
  const thumbs = Array.isArray(value) ? value.length : 1

  return (
    <SliderPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      onValueCommitted={onValueCommitted}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={cn("relative w-full select-none touch-none", className)}
      {...props}
    >
      <SliderPrimitive.Control className="relative flex h-5 w-full items-center">
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
          <SliderPrimitive.Indicator className="absolute h-full bg-foreground" />
        </SliderPrimitive.Track>
        {Array.from({ length: thumbs }, (_, i) => (
          <SliderPrimitive.Thumb
            key={i}
            index={i}
            className={cn(
              "block h-4 w-4 shrink-0 rounded-full border-2 border-foreground bg-background shadow-sm cursor-grab",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "active:cursor-grabbing disabled:pointer-events-none disabled:opacity-50",
            )}
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
