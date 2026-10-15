'use client';

/**
 * A contact form with no backend: it composes the message and hands it to the reader's own email
 * app (`mailto:`) when the site has a contact address, or opens a prefilled issue on the public
 * repository when it does not. (A plain `<form action="mailto:">` is blocked by the site's CSP
 * `form-action 'self'`, so the link is built in script.)
 */

import { useState, type FormEvent } from 'react';
import { Github, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { navigateTo } from '@/lib/browser';

const TOPICS = ['Correction in a devotional', 'Feedback or a feature idea', 'Something is not working', 'Copyright or content request', 'Other'] as const;

export function ContactForm({ email, repoUrl }: { email: string; repoUrl: string }) {
  const [topic, setTopic] = useState<(typeof TOPICS)[number]>(TOPICS[0]);
  const [page, setPage] = useState('');
  const [message, setMessage] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const subject = `[Rhapsody site] ${topic}`;
    const body = `${message.trim()}\n\n${page.trim() ? `Page: ${page.trim()}\n` : ''}Sent from ${window.location.host}`;
    if (email) {
      navigateTo(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
      return;
    }
    const url = `${repoUrl}/issues/new?title=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-border/70 bg-card p-6">
      <div className="grid gap-1.5">
        <label htmlFor="contact-topic" className="text-sm font-medium">
          What is it about?
        </label>
        <select
          id="contact-topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value as (typeof TOPICS)[number])}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {TOPICS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="contact-page" className="text-sm font-medium">
          Page or date (optional)
        </label>
        <input
          id="contact-page"
          value={page}
          onChange={(e) => setPage(e.target.value)}
          placeholder="e.g. 15 October 2026, or the page address"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="contact-message" className="text-sm font-medium">
          Message
        </label>
        <textarea
          id="contact-message"
          required
          minLength={10}
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {email ? 'Opens your email app with the message ready to send.' : 'Opens a prefilled report on GitHub (a free account is needed to post).'}
        </p>
        <Button type="submit">
          {email ? <Mail className="w-4 h-4 mr-2" aria-hidden="true" /> : <Github className="w-4 h-4 mr-2" aria-hidden="true" />}
          {email ? 'Write the email' : 'Open the report'}
        </Button>
      </div>
    </form>
  );
}
