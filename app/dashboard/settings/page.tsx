import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongoose";
import { RoutingRule } from "@/models/RoutingRule";
import { SettingsPanel } from "@/components/dashboard/settings-panel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await (await getAuth()).api.getSession({ headers: await headers() });
  if (!session) return null;

  const user = session.user as typeof session.user & {
    fromName?: string;
    fromAlias?: string;
  };

  await connectToDatabase();
  const rules = await RoutingRule.find().sort({ createdAt: 1 }).lean();

  return (
    <SettingsPanel
      user={{
        email: user.email,
        name: user.name,
        fromName: user.fromName,
        fromAlias: user.fromAlias,
      }}
      rules={rules.map((r) => ({
        id: String(r._id),
        alias: r.alias,
        forwardTo: r.forwardTo,
        active: r.active,
      }))}
    />
  );
}
