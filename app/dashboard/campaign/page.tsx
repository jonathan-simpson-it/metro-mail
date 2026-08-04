import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { CampaignWorkspace } from "@/components/dashboard/campaign-workspace";
import { DEFAULT_SENDER_ALIAS, DEFAULT_SENDER_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function CampaignPage() {
  const session = await (await getAuth()).api.getSession({ headers: await headers() });
  if (!session) return null;

  const user = session.user as typeof session.user & {
    fromName?: string;
    fromAlias?: string;
  };

  return (
    <CampaignWorkspace
      defaultFromName={user.fromName || DEFAULT_SENDER_NAME}
      defaultFromAlias={user.fromAlias || DEFAULT_SENDER_ALIAS}
    />
  );
}
