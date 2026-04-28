import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, ExternalLink, Eye, Share2 } from "lucide-react";
import { getPostBySlug, MOCK_POSTS } from "@/lib/mockPosts";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/PostCard";

const PostDetail = () => {
  const { channelSlug = "", slug = "" } = useParams();
  const post = getPostBySlug(channelSlug, slug);

  useEffect(() => {
    if (post) document.title = `${post.title} — Meaning`;
  }, [post]);

  if (!post) {
    return (
      <div className="container py-32 text-center">
        <h1 className="font-serif text-4xl mb-4">Post not found</h1>
        <Button asChild><Link to="/blog">Back to blog</Link></Button>
      </div>
    );
  }

  const related = MOCK_POSTS.filter(p => p.channelSlug === channelSlug && p.id !== post.id).slice(0, 3);

  return (
    <article className="pb-24">
      <div className="container max-w-3xl pt-12">
        <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to blog
        </Link>

        <motion.header initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Link to={`/channels/${post.channelSlug}`} className="text-sm uppercase tracking-wider text-primary font-medium">
            {post.channelName}
          </Link>
          <h1 className="font-serif text-4xl md:text-6xl font-semibold leading-[1.1] tracking-tight mt-3 text-balance">
            {post.title}
          </h1>
          <div className="mt-6 flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
            <time dateTime={post.publishedAt}>
              {new Date(post.publishedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
            </time>
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {post.readingMinutes} min read</span>
            <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> {post.views.toLocaleString()} views</span>
          </div>
        </motion.header>

        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.15 }}
          className="prose-blog mt-12"
        >
          {post.content.split("\n\n").map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </motion.div>

        <div className="mt-12 flex flex-wrap items-center gap-3 pt-8 border-t border-border">
          {post.tags.map(t => (
            <span key={t} className="px-3 py-1 rounded-full bg-secondary text-xs">#{t}</span>
          ))}
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={post.telegramUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" /> Telegram
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigator.share?.({ title: post.title, url: location.href }).catch(() => {})}>
              <Share2 className="w-4 h-4 mr-2" /> Share
            </Button>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="container max-w-6xl mt-24">
          <h2 className="font-serif text-3xl font-semibold mb-8">More from {post.channelName}</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {related.map((p, i) => <PostCard key={p.id} post={p} index={i} />)}
          </div>
        </section>
      )}
    </article>
  );
};

export default PostDetail;
