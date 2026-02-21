"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AuthLayout } from "@/components/auth/auth-layout"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Eye, EyeOff, Lock, Check, X } from "lucide-react"

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8+ characters", met: password.length >= 8 },
    { label: "Uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Lowercase letter", met: /[a-z]/.test(password) },
    { label: "Number", met: /[0-9]/.test(password) },
  ]
  const strength = checks.filter((c) => c.met).length

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full transition-colors"
            style={{
              backgroundColor:
                i <= strength
                  ? strength <= 1
                    ? "#FF6B6B"
                    : strength <= 2
                    ? "#FFB347"
                    : "#4ECDC4"
                  : "#D1E3F6",
            }}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1">
        {checks.map((check) => (
          <div key={check.label} className="flex items-center gap-1">
            {check.met ? (
              <Check className="h-3 w-3 text-mint" />
            ) : (
              <X className="h-3 w-3 text-muted-foreground" />
            )}
            <span className={`text-xs ${check.met ? "text-mint" : "text-muted-foreground"}`}>{check.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SignUpPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" })
  const [showPassword, setShowPassword] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [isStudent, setIsStudent] = useState(false)
  const [emailError, setEmailError] = useState("")

  const validateEmail = (email: string) => {
    if (email && !email.endsWith("@umd.edu")) {
      setEmailError("Please use your @umd.edu email address")
    } else {
      setEmailError("")
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    router.push("/onboarding")
  }

  return (
    <AuthLayout
      footerLink={{ href: "/login", label: "Login" }}
      footerText="Already have an account?"
    >
      <h1 className="font-heading text-2xl font-bold text-navy md:text-3xl">Create Your Account</h1>
      <p className="mt-2 text-muted-foreground">Use your UMD email to get started</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            placeholder="Your full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-xl border-border focus:border-secondary focus:ring-secondary"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">UMD Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="your.name@umd.edu"
            value={form.email}
            onChange={(e) => {
              setForm({ ...form, email: e.target.value })
              validateEmail(e.target.value)
            }}
            className="rounded-xl border-border focus:border-secondary focus:ring-secondary"
            required
          />
          {emailError && <p className="text-xs text-coral">{emailError}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Create a strong password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="rounded-xl border-border pr-10 focus:border-secondary focus:ring-secondary"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {form.password && <PasswordStrength password={form.password} />}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="Re-enter your password"
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            className="rounded-xl border-border focus:border-secondary focus:ring-secondary"
            required
          />
          {form.confirmPassword && form.password !== form.confirmPassword && (
            <p className="text-xs text-coral">Passwords do not match</p>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox id="student" checked={isStudent} onCheckedChange={(v) => setIsStudent(v === true)} />
            <Label htmlFor="student" className="text-sm font-normal">I am a current UMD student</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="terms" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
            <Label htmlFor="terms" className="text-sm font-normal">
              I agree to the{" "}
              <a href="#" className="text-secondary underline">Community Guidelines</a> and{" "}
              <a href="#" className="text-secondary underline">Terms</a>
            </Label>
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-coral py-3 text-base font-semibold text-white transition-colors hover:bg-coral/90 disabled:opacity-50"
          disabled={!agreed || !isStudent}
        >
          Create Account
        </button>

        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-card px-4 text-sm text-muted-foreground">or</span>
          </div>
        </div>

        <button
          type="button"
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-secondary/30 py-3 text-sm font-medium text-navy transition-colors hover:bg-secondary/5"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google (@umd.edu only)
        </button>

        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" /> Your data is private and never sold
        </p>
      </form>
    </AuthLayout>
  )
}
