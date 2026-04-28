import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getChannel } from "@/lib/channels";
import { getPostsByChannel } from "@/lib/mockPosts";
import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui/button";

const ChannelDetail = () => {
  const { slug = "" } = useParams();
  const channel = getChannel(slug);

  if (!channel) {
    return (
      <div className="container py-32 text-center">
        <h1 className="font-serif text-4xl mb-4">Channel not found</h1>
        <Button asChild><Link to="/channels">All channels</Link></Button>
      </div>
    );
  }

  const posts = getPostsByChannel(slug).sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));

  return (
    <div className="pb-24">
      <section className={`bg-gradient-to-br ${channel.accent} text-white`}>
        <div className="container py-20 max-w-4xl">
          <Link to="/channels" className="inline-flex items-center gap-2 text-sm opacity-80 hover:opacity-100 mb-6">
            <ArrowLeft className="w-4 h-4" /> All channels
          </Link>
          <motion.h1
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="font-serif text-5xl md:text-6xl font-semibold text-balance leading-[1.05]"
          >
            {channel.name}
          </motion.h1>
          <p className="mt-4 text-lg md:text-xl opacity-90 max-w-2xl">{channel.description}</p>
          <Button asChild variant="secondary" className="mt-6">
            <a href={channel.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" /> View on Telegram
            </a>
          </Button>
        </div>
      </section>

      <section className="container py-16">
        <h2 className="font-serif text-3xl font-semibold mb-8">{posts.length} posts</h2>
        {posts.length === 0 ? (
          <p className="text-muted-foreground">No posts synced yet.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((p, i) => <PostCard key={p.id} post={p} index={i} />)}
          </div>
        )}
      </section>
    </div>
  );
};

export default ChannelDetail;
