import type { UserRole } from "../types"

// Só o e-mail do proprietário e os metadados protegidos definem o perfil.
export function trustedUserRole(
  email?: string,
  appMetadata?: Record<string, unknown>,
): UserRole | null {
  if (
    email?.toLowerCase() === "admin@fitpro.internal" ||
    appMetadata?.is_owner === true
  ) {
    return "owner"
  }

  const role = appMetadata?.role
  return role === "admin" || role === "professor" || role === "aluno"
    ? role
    : null
}
