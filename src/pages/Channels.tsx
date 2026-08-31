import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, Radio } from 'lucide-react';
import { useChannels } from '@/lib/queries';
import { EmptyState, ErrorState, PageHeader } from '@/components/common/StateBlocks';
import { Skeleton } from '@/components/ui/skeleton';
import { useSeo } from '@/hooks/useSeo';
import { timeAgo } from '@/lib/format';

const Channels = () => {
  useSeo({
    title: 'Channels',
    description: 'Every Telegram channel synced into Meaning — devotionals, teachings, books and gospel music.',
    path: '/channels',
  });
  const query = useChannels();

  return (
    <div className="container py-16">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <PageHeader
          eyebrow="Sources"
          title="Channels we sync"
          subtitle="Each Telegram channel below is synced automatically. New posts appear here as blog articles within minutes."
        />
      </motion.div>

      {query.isPending && (
        <div className="mt-12 grid md:grid-cols-2 gap-6" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}
        </div>
      )}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {query.isSuccess && query.data.channels.length === 0 && (
        <EmptyState title="No channels configured yet" hint="An editor can add channels via the worker configuration." />
      )}

      <div className="mt-12 grid md:grid-cols-2 gap-6">
        {(query.data?.channels ?? []).map((c, i) => (
          <motion.div
            key={c.slug}
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.06 }}
          >
            <Link
              to={`/channels/${c.slug}`}
              className={`group block rounded-2xl p-8 bg-gradient-to-br ${c.accent} text-white shadow-soft hover:shadow-elegant transition-all hover:-translate-y-1 relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
            >
              <Radio className="w-6 h-6 opacity-80" aria-hidden="true" />
              <h2 className="font-serif text-3xl font-semibold mt-4 leading-tight">{c.name}</h2>
              <p className="mt-2 opacity-90 leading-relaxed">{c.description}</p>
              <div className="mt-6 flex items-center justify-between text-sm">
                <span className="opacity-80">
                  @{c.username} · {c.postCount} post{c.postCount === 1 ? '' : 's'}
                  {c.lastSyncedAt ? ` · synced ${timeAgo(c.lastSyncedAt)}` : ''}
                </span>
                <ArrowUpRight className="w-5 h-5 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Channels;
