import { cn } from "@/lib/utils"

export function PhoneFrame({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background shadow-2xl shadow-black/50 md:my-6 md:min-h-[calc(100vh-3rem)] md:overflow-hidden md:rounded-[2.4rem] md:border md:border-white/10">
        <div className={cn("relative flex min-h-0 flex-1 flex-col", className)}>
          {children}
        </div>
      </div>
    </div>
  )
}
