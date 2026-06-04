import { notFound } from "next/navigation";

/**
 * Catch-all route for unknown localized paths.
 *
 * Next.js only renders `app/[locale]/not-found.tsx` when a route inside the
 * locale segment calls `notFound()`. This page catches URLs such as `/en/abc`
 * or `/id/random/path` and forwards them to the localized 404 UI.
 */
export default function LocalizedCatchAllNotFound() {
  notFound();
}
