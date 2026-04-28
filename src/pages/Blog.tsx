import { useState, useMemo } from "react";
import { MOCK_POSTS } from "@/lib/mockPosts";
import { CHANNELS } from "@/lib/channels";
import { PostCard } from "@/components/PostCard";
import { motion } from "framer-motion";

const Blog = () => {
  const [filter, setFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const list = filter === "all" ? MOCK_POSTS : MOCK_POSTS.filter(p => p.channelSlug === filter);
    return [...list].sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
  }, [filter]);

  return (
    <div className="container py-16">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <span className="text-sm uppercase tracking-wider text-primary font-medium">The Blog</span>
        <h1 className="font-serif text-5xl md:text-6xl font-semibold mt-2 text-balance">Every word, archived & searchable.</h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
          Browse devotionals, teachings, book excerpts and music spotlights — automatically synced from Telegram.
        </p>
      </motion.div>

      <div className="mt-10 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            filter === "all" ? "bg-primary text-primary-foreground shadow-soft" : "bg-secondary hover:bg-secondary/70"
          }`}
        >All</button>
        {CHANNELS.map(c => (
          <button
            key={c.slug}
            onClick={() => setFilter(c.slug)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              filter === c.slug ? "bg-primary text-primary-foreground shadow-soft" : "bg-secondary hover:bg-secondary/70"
            }`}
          >{c.name}</button>
        ))}
      </div>

      <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((p, i) => <PostCard key={p.id} post={p} index={i} />)}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-24">No posts yet for this channel.</p>
      )}
    </div>
  );
};

export default Blog;
