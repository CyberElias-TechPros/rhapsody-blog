import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, RefreshCw, Settings2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CHANNELS } from "@/lib/channels";
import { MOCK_POSTS } from "@/lib/mockPosts";

const Admin = () => {
  const [syncing, setSyncing] = useState<string | null>(null);

  const stats = [
    { label: "Channels", value: CHANNELS.length, icon: Settings2 },
    { label: "Posts synced", value: MOCK_POSTS.length, icon: CheckCircle2 },
    { label: "Subscribers", value: "—", icon: Users },
  ];

  const triggerSync = (slug: string) => {
    setSyncing(slug);
    // POST /api/admin/sync/:channelSlug
    setTimeout(() => setSyncing(null), 1500);
  };

  return (
    <div className="container py-16">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <span className="text-sm uppercase tracking-wider text-primary font-medium">Admin</span>
          <h1 className="font-serif text-5xl font-semibold mt-2">Dashboard</h1>
          <p className="text-muted-foreground mt-2">Manage channel sync, content moderation and subscribers.</p>
        </div>
        <Button onClick={() => CHANNELS.forEach(c => triggerSync(c.slug))} className="gradient-hero text-primary-foreground border-0">
          <RefreshCw className="w-4 h-4 mr-2" /> Sync all
        </Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mt-10">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.06 }}
            className="gradient-card rounded-2xl p-6 border border-border/60 shadow-soft flex items-center gap-4"
          >
            <div className="grid place-items-center w-11 h-11 rounded-xl bg-secondary"><s.icon className="w-5 h-5 text-primary" /></div>
            <div>
              <div className="text-2xl font-serif font-semibold">{s.value}</div>
              <div className="text-sm text-muted-foreground">{s.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <h2 className="font-serif text-2xl font-semibold mt-14 mb-4">Channel Sync Status</h2>
      <div className="gradient-card rounded-2xl border border-border/60 overflow-hidden shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left">
            <tr>
              <th className="px-5 py-3 font-medium">Channel</th>
              <th className="px-5 py-3 font-medium">Username</th>
              <th className="px-5 py-3 font-medium">Posts</th>
              <th className="px-5 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {CHANNELS.map(c => {
              const count = MOCK_POSTS.filter(p => p.channelSlug === c.slug).length;
              return (
                <tr key={c.slug} className="border-t border-border/60">
                  <td className="px-5 py-4 font-medium">{c.name}</td>
                  <td className="px-5 py-4 text-muted-foreground">@{c.username}</td>
                  <td className="px-5 py-4">{count}</td>
                  <td className="px-5 py-4 text-right">
                    <Button size="sm" variant="outline" disabled={syncing === c.slug} onClick={() => triggerSync(c.slug)}>
                      {syncing === c.slug ? (
                        <><RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> Syncing</>
                      ) : (
                        <><RefreshCw className="w-3.5 h-3.5 mr-2" /> Sync</>
                      )}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Admin;
