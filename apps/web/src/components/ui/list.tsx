import * as React from "react"
import { cn } from "@/lib/utils"

export interface ListProps extends React.HTMLAttributes<HTMLUListElement> {
  variant?: "plain" | "outlined" | "elevated"
}

export const List = React.forwardRef<HTMLUListElement, ListProps>(
  ({ className, variant = "plain", ...props }, ref) => {
    return (
      <ul
        ref={ref}
        className={cn(
          "flex flex-col gap-2 p-0 m-0 list-none",
          variant === "outlined" && "border border-[var(--outline)] rounded-lg",
          variant === "elevated" && "shadow-md rounded-lg",
          className
        )}
        {...props}
      />
    )
  }
)
List.displayName = "List"
