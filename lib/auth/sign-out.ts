export interface SignOutDependencies {
  signOutSupabase: () => Promise<{ error: Error | null }>
  clearLocalSession: () => void
  purgeProtectedCache: () => void
}

export async function signOutEverywhere(
  dependencies: SignOutDependencies
): Promise<{ error: Error | null }> {
  try {
    const result = await dependencies.signOutSupabase()
    if (result.error) {
      return { error: result.error }
    }

    dependencies.clearLocalSession()
    dependencies.purgeProtectedCache()
    return { error: null }
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error("Supabase sign-out failed"),
    }
  }
}
