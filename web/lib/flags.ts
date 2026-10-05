export function isAdminUiEnabled() {
  const flag = process.env.NEXT_PUBLIC_SHOW_ADMIN?.trim().toLowerCase()
  return flag === "1" || flag === "true" || flag === "yes"
}
