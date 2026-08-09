import { cn } from "@/lib/utils"

export function PhoneFrame({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className="phone-frame-min-height bg-background text-foreground">
      <div className="phone-frame-height mx-auto flex w-full max-w-md flex-col bg-background shadow-2xl shadow-black/50 md:my-6 md:overflow-hidden md:rounded-[2.4rem] md:border md:border-white/10">
        <div className={cn("relative flex min-h-0 flex-1 flex-col", className)}>
          {children}
        </div>
      </div>
    </div>
  )
}
