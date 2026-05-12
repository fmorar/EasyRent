import { redirect } from "next/navigation"

/**
 * /invitations used to be a standalone page showing the full invitation
 * log alongside stat tiles. Its content was merged into /agents (the
 * "team" page), which already showed the active members + pending
 * invitations side-by-side. We keep this route as a permanent redirect
 * so dashboard chips, old emails and bookmarks still work.
 */
export default function InvitationsRedirect() {
  redirect("/agents")
}
