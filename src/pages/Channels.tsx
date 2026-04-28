import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CHANNELS } from "@/lib/channels";
import { MOCK_POSTS } from "@/lib/mockPosts";
import { ArrowUpRight, Radio } from "lucide-react";

const Channels = () => (
  <div className="container py-16">
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
      <span className="text-sm uppercase tracking-wider text-primary font-medium">Sources</span>
      <h1 className="font-serif text-5xl md:text-6xl font-semibold mt-2 text-balance">Channels we sync</h1>
      <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
        Each Telegram channel below is synced automatically. New posts appear here as blog articles within minutes.
      </p>
    </motion.div>

    <div className="mt-12 grid md:grid-cols-2 gap-6">
      {CHANNELS.map((c, i) => {
        const count = MOCK_POSTS.filter(p => p.channelSlug === c.slug).length;
        return (
          <motion.div
            key={c.slug}
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.06 }}
          >
            <Link
              to={`/channels/${c.slug}`}
              className={`group block rounded-2xl p-8 bg-gradient-to-br ${c.accent} text-white shadow-soft hover:shadow-elegant transition-all hover:-translate-y-1 relative overflow-hidden`}
            >
              <Radio className="w-6 h-6 opacity-80" />
              <h3 className="font-serif text-3xl font-semibold mt-4 leading-tight">{c.name}</h3>
              <p className="mt-2 opacity-90 leading-relaxed">{c.description}</p>
              <div className="mt-6 flex items-center justify-between text-sm">
                <span className="opacity-80">@{c.username} · {count} posts</span>
                <ArrowUpRight className="w-5 h-5 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  </div>
);

export default Channels;
