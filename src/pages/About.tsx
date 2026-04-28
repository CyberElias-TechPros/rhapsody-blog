import { motion } from "framer-motion";
import { BookOpen, RefreshCw, Search, Shield } from "lucide-react";

const features = [
  { icon: RefreshCw, title: "Auto-sync", desc: "We poll each Telegram channel and convert new messages into clean blog posts." },
  { icon: Search, title: "Searchable", desc: "Full-text search across every devotional, teaching, book and music post." },
  { icon: BookOpen, title: "Beautifully readable", desc: "Typography & layouts designed for distraction-free, immersive reading." },
  { icon: Shield, title: "Faithful & safe", desc: "Content stays attributed to its source. We only mirror, never alter the message." },
];

const About = () => (
  <div className="container py-20 max-w-4xl">
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
      <span className="text-sm uppercase tracking-wider text-primary font-medium">About</span>
      <h1 className="font-serif text-5xl md:text-6xl font-semibold mt-2 text-balance leading-[1.05]">
        Giving your life a meaning — one word at a time.
      </h1>
      <p className="mt-6 text-xl text-muted-foreground leading-relaxed">
        Meaning is a quiet companion to your favourite Telegram channels. Every post becomes a
        readable, searchable blog article — so the message keeps speaking long after the notification fades.
      </p>
    </motion.div>

    <div className="grid md:grid-cols-2 gap-6 mt-14">
      {features.map((f, i) => (
        <motion.div
          key={f.title}
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.08 }}
          className="gradient-card rounded-2xl p-7 border border-border/60 shadow-soft"
        >
          <div className="grid place-items-center w-11 h-11 rounded-xl gradient-hero shadow-glow">
            <f.icon className="w-5 h-5 text-primary-foreground" />
          </div>
          <h3 className="font-serif text-2xl font-semibold mt-5">{f.title}</h3>
          <p className="text-muted-foreground mt-2 leading-relaxed">{f.desc}</p>
        </motion.div>
      ))}
    </div>
  </div>
);

export default About;
