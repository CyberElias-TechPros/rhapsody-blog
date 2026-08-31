import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PostCard } from './PostCard';
import type { PostListItem } from '@/lib/types';

const post: PostListItem = {
  id: 'p1',
  channelSlug: 'ror',
  channelName: 'Rhapsody of Realities',
  title: 'Renewed Mind',
  slug: 'renewed-mind-101',
  excerpt: 'Today’s meditation renews your thinking.',
  publishedAt: '2026-03-03T08:00:00Z',
  readingMinutes: 4,
  tags: ['faith'],
  views: 1200,
  coverUrl: null,
};

const renderCard = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('PostCard', () => {
  it('links to the canonical post route built from channel + slug', () => {
    renderCard(<PostCard post={post} />);
    const link = screen.getByRole('link', { name: /renewed mind/i });
    expect(link).toHaveAttribute('href', '/blog/ror/renewed-mind-101');
  });

  it('shows formatted date and reading time, never raw ISO strings', () => {
    renderCard(<PostCard post={post} />);
    expect(screen.getByText('Mar 3, 2026')).toBeInTheDocument();
    expect(screen.getByText(/4 min read/i)).toBeInTheDocument();
    expect(screen.queryByText(/2026-03-03T/)).not.toBeInTheDocument();
  });

  it('renders the bookmark toggle with pressed state and calls back without navigating', async () => {
    const onToggleBookmark = vi.fn();
    renderCard(<PostCard post={post} bookmarked onToggleBookmark={onToggleBookmark} />);
    const btn = screen.getByRole('button', { name: /remove “renewed mind” from bookmarks/i });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(btn);
    expect(onToggleBookmark).toHaveBeenCalledTimes(1);
    expect(onToggleBookmark.mock.calls[0][0]).toMatchObject({ id: 'p1' });
  });

  it('hides the bookmark control when no handler is given (e.g. related posts)', () => {
    renderCard(<PostCard post={post} />);
    expect(screen.queryByRole('button', { name: /bookmarks/i })).not.toBeInTheDocument();
  });

  it('renders a cover image when present and omits otherwise', () => {
    const { container, unmount } = renderCard(<PostCard post={{ ...post, coverUrl: 'https://cdn.test/x.jpg' }} />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', 'https://cdn.test/x.jpg');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('alt', ''); // decorative — title carries the meaning
    unmount();
    const second = renderCard(<PostCard post={post} />);
    expect(second.container.querySelectorAll('img')).toHaveLength(0);
  });
});
