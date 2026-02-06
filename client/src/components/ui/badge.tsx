import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-gradient-to-r from-[#00d4ff] via-[#3b82f6] to-[#2563eb] text-white shadow-[0_0_10px_rgba(59,130,246,0.4)]", // 10³ blue-cyan
        first:
          "border-transparent bg-gradient-to-r from-[#ffd700] via-[#f59e0b] to-[#ca8a04] text-black shadow-[0_0_10px_rgba(255,215,0,0.5)]", // 1st gold
        silver:
          "border-transparent bg-gradient-to-r from-[#e5e7eb] via-[#9ca3af] to-[#6b7280] text-black", // 10¹ silver
        bronze:
          "border-transparent bg-gradient-to-r from-[#ff6b00] via-[#ea580c] to-[#c2410c] text-white", // 10² bronze/orange
        glass:
          "border-white/20 bg-white/10 text-white backdrop-blur-sm", // 10⁴ glass
        founder:
          "border-white/20 bg-black text-white", // F founder solid black
        active:
          "border-[#00ff9d]/30 bg-[#00ff9d]/15 text-[#00ff9d] shadow-[0_0_10px_rgba(0,255,157,0.3)]", // Active neon green
        outline: "text-violet-300 border-violet-500/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
