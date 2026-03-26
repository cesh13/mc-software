import * as React from "react"
import { cn } from "@/lib/utils"

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "elevated" | "outlined" | "flat"
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "elevated", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl bg-[var(--surface-container)] text-[var(--on_surface)] transition-shadow",
          variant === "elevated" && "shadow-md hover:shadow-lg",
          variant === "outlined" && "border border-[var(--outline)]",
          variant === "flat" && "shadow-none border-none",
          className
        )}
        {...props}
      />
    )
  }
)
Card.displayName = "Card"
