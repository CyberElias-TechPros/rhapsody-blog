import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Radio, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CHANNELS } from "@/lib/channels";
import { MOCK_POSTS } from "@/lib/mockPosts";
import { PostCard } from "@/components/PostCard";
import heroImg from "@/assets/hero-light.jpg";

const Index = () => {
  const recent = [...MOCK_POSTS].sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt)).slice(0, 6);

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img src={heroImg} alt="" className="w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
        </div>
        <div className="container pt-24 pb-28 md:pt-32 md:pb-36 text-center max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/80 border border-border text-sm mb-6"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Giving your life a meaning</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.05 }}
            className="font-serif text-5xl md:text-7xl font-semibold tracking-tight text-balance leading-[1.05]"
          >
            Every Telegram broadcast,{" "}
            <span className="bg-gradient-to-br from-primary via-primary-glow to-accent bg-clip-text text-transparent">
              reborn as a blog.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            We auto-sync devotionals, teachings, books and music from Rhapsody of Realities,
            Pastor Chris and more — into a clean, searchable, beautifully readable library.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.35 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-3"
          >
            <Button asChild size="lg" className="shadow-elegant gradient-hero text-primary-foreground border-0">
              <Link to="/blog">Read the blog <ArrowRight className="ml-2 w-4 h-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/channels">Browse channels</Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* CHANNELS STRIP */}
      <section className="container -mt-12 relative">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {CHANNELS.map((c, i) => (
            <motion.div
              key={c.slug}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.06 }}
            >
              <Link
                to={`/channels/${c.slug}`}
                className={`block rounded-xl p-4 bg-gradient-to-br ${c.accent} text-white shadow-soft hover:shadow-elegant transition-all hover:-translate-y-1 h-full`}
              >
                <Radio className="w-4 h-4 opacity-80" />
                <div className="mt-3 font-serif text-lg font-semibold leading-tight">{c.name}</div>
                <div className="mt-1 text-xs opacity-80">@{c.username}</div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* RECENT POSTS */}
      <section className="container py-24">
        <div className="flex items-end justify-between mb-10">
          <div>
            <span className="text-sm uppercase tracking-wider text-primary font-medium">Latest</span>
            <h2 className="font-serif text-4xl md:text-5xl font-semibold mt-2">Fresh from the channels</h2>
          </div>
          <Button asChild variant="ghost" className="hidden md:inline-flex">
            <Link to="/blog">View all <ArrowRight className="ml-2 w-4 h-4" /></Link>
          </Button>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recent.map((p, i) => <PostCard key={p.id} post={p} index={i} />)}
        </div>
      </section>

      {/* CTA */}
      <section className="container pb-24">
        <div className="relative overflow-hidden rounded-3xl gradient-hero text-primary-foreground p-12 md:p-16 text-center shadow-elegant">
          <BookOpen className="w-10 h-10 mx-auto mb-4 opacity-90" />
          <h3 className="font-serif text-3xl md:text-4xl font-semibold max-w-2xl mx-auto text-balance">
            Never miss a word. Get every devotional in your inbox.
          </h3>
          <p className="mt-3 opacity-90 max-w-xl mx-auto">
            Join thousands receiving daily inspiration from your favourite channels.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-7">
            <Link to="/register">Create a free account</Link>
          </Button>
        </div>
      </section>
    </>
  );
};

export default Index;
