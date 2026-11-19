import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // The main call to action wears the brand accent. Reserving jade for
        // things that actually do something is what lets it carry weight.
        default:
          "bg-accent text-accent-foreground shadow-sm hover:bg-[var(--accent-hover)] active:translate-y-px",
        // Ink: for a strong action that is not the primary one on the screen,
        // so two buttons never compete for the same emphasis.
        ink: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:translate-y-px",
        // Saffron: draws the eye without implying an error — "issue receipt",
        // "needs attention".
        gold:
          "bg-[var(--gold)] text-[var(--gold-foreground)] shadow-sm hover:bg-[var(--gold-deep)] hover:text-white active:translate-y-px",
        destructive:
          "bg-destructive text-white shadow-sm hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 active:translate-y-px",
        // Outline and ghost hover to a quiet surface rather than flooding with
        // accent — otherwise every toolbar flashes jade and the accent stops
        // meaning anything.
        outline:
          "border border-border bg-background shadow-xs hover:bg-secondary hover:border-[var(--accent)]/40 active:translate-y-px dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/70 active:translate-y-px",
        ghost: "hover:bg-secondary hover:text-foreground dark:hover:bg-secondary/60",
        link: "text-[var(--accent-deep)] underline-offset-4 hover:underline dark:text-[var(--accent)]",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
