export { default } from "next-auth/middleware"

// Tailor this matcher to YOUR app's protected routes. Listing every page here
// is worse than listing a prefix — never blanket-protect "/" or the landing
// page, sign-in flows won't be reachable.
export const config = {
  matcher: ["/admin/:path*"],
}
