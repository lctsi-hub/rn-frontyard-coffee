/** Only allow redirects back into the staff area after sign-in (no open redirects). */
export function safeNextPath(next: unknown) {
  return typeof next === "string" && /^\/(admin|kitchen)(\/[\w\-/]*)?$/.test(next) && next !== "/admin/login" ? next : "/admin";
}
