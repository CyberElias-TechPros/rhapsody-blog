import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight, Clock } from "lucide-react";
import type { BlogPost } from "@/lib/mockPosts";

export const PostCard = ({ post, index = 0 }: { post: BlogPost; index?: number }) => {
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="group"
    >
      <Link
        to={`/blog/${post.channelSlug}/${post.slug}`}
        className="block gradient-card rounded-2xl p-6 border border-border/60 hover:border-primary/40 transition-all hover:shadow-elegant h-full"
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs uppercase tracking-wider font-medium text-primary">
            {post.channelName}
          </span>
          <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
        <h3 className="font-serif text-2xl font-semibold leading-tight text-balance mb-3 group-hover:text-primary transition-colors">
          {post.title}
        </h3>
        <p className="text-muted-foreground line-clamp-3 mb-5">{post.excerpt}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <time dateTime={post.publishedAt}>
            {new Date(post.publishedAt).toLocaleDateString(undefined, {
              month: "short", day: "numeric", year: "numeric",
            })}
          </time>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> {post.readingMinutes} min read
          </span>
        </div>
      </Link>
    </motion.article>
  );
};
