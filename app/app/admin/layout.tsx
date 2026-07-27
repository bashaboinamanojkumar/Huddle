import { redirect } from "next/navigation"
import { isSafetyOwner } from "@/lib/auth/admin"
import { createClient } from "@/lib/supabase/server"

async function isAuthorizedSafetyOwner(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return Boolean(user) && isSafetyOwner(user?.app_metadata)
  } catch {
    return false
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // `redirect` signals by throwing, so it must stay outside the lookup's catch.
  if (!(await isAuthorizedSafetyOwner())) {
    redirect("/app")
  }

  return children
}
