import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { getDailySendStats } from "@/lib/send-policy";
import { DEFAULT_SENDER_ALIAS, formatSenderAddress, resolveSenderAlias } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight daily-send quota for the compose send guard and campaign
 * indicator: how many emails have been sent today from a sender address,
 * plus the hard daily limit and the cold-outreach ceiling.
 *
 * The queried alias is restricted to the session user's own sender alias
 * (or the shared default) — this is not an address enumeration endpoint.
 */
export async function GET(request: Request) {
  const session = await (await getAuth()).api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as typeof session.user & { fromAlias?: string };
  const ownAlias = resolveSenderAlias(user.fromAlias);
  const requested = new URL(request.url).searchParams.get("alias")?.trim().toLowerCase();
  const alias =
    requested && (requested === ownAlias || requested === DEFAULT_SENDER_ALIAS)
      ? requested
      : ownAlias;
  const address = formatSenderAddress(alias);

  return Response.json(await getDailySendStats(address));
}
