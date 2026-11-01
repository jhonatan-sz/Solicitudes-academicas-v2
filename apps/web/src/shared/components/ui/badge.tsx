import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/shared/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "bg-destructive text-white focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/90",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
        // Status variants
        "status-approved": "bg-success-soft text-success border border-success/20",
        "status-pending": "bg-info-soft text-info border border-info/20",
        "status-review": "bg-warning-soft text-warning border border-warning/20",
        "status-rejected": "bg-danger-soft text-danger border border-danger/20",
        "status-draft": "bg-surface-hover text-muted-foreground border border-border",
        "status-cancelled": "bg-surface-hover text-muted-foreground border border-border",
        "status-pending-docs": "bg-warning-soft text-warning border border-warning/20",
        // Role variants
        "role-admin": "bg-primary/10 text-primary border border-primary/20 dark:bg-navy-900/60 dark:text-gold-400 dark:border-gold-700/50",
        "role-student": "bg-info-soft text-info border border-info/20",
        "role-staff": "bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800",
        "role-coordinator": "bg-primary/10 text-primary border border-primary/20 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
        // State variants
        active: "bg-success-soft text-success border border-success/20",
        inactive: "bg-surface-hover text-muted-foreground border border-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge }
