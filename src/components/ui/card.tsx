import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * `variant`:
 *   - `default` — Standard chrome: background, ring, padding, rounded.
 *   - `bare`    — Strip every visual chrome: no background, no ring, no
 *                 padding, no rounded corners. Keep only the flex stack
 *                 + gap so the same layout primitive can be used inside
 *                 a parent that already provides a container. Use this
 *                 instead of nesting Cards.
 *
 * `size`:
 *   - `default` — Comfortable: `gap-4 py-4` + `px-4` content.
 *   - `sm`      — Compact:     `gap-3 py-3` + `px-3` content.
 */
function Card({
  className,
  size = "default",
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & {
  size?:    "default" | "sm"
  variant?: "default" | "bare"
}) {
  return (
    <div
      data-slot="card"
      data-size={size}
      data-variant={variant}
      className={cn(
        "group/card flex flex-col gap-4 text-sm text-card-foreground",
        // Default chrome — shed entirely when variant=bare.
        variant === "default" &&
          "overflow-hidden rounded-xl bg-card py-4 ring-1 ring-foreground/10 has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        variant === "bare" && "data-[size=sm]:gap-3",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-4 group-data-[size=sm]/card:px-3 group-data-[variant=bare]/card:px-0 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-4 group-data-[size=sm]/card:[.border-b]:pb-3",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn(
        "px-4 group-data-[size=sm]/card:px-3 group-data-[variant=bare]/card:px-0",
        className
      )}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-4 group-data-[size=sm]/card:p-3 group-data-[variant=bare]/card:rounded-none group-data-[variant=bare]/card:border-0 group-data-[variant=bare]/card:bg-transparent group-data-[variant=bare]/card:p-0",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
