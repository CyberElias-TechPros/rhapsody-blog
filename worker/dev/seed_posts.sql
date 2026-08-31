-- dev_seed_posts.sql — LOCAL DEVELOPMENT ONLY.
-- Seeds a few example posts so a fresh `wrangler dev` environment has content.
-- NEVER apply this file against production: production content comes from the
-- Telegram sync (cron trigger / POST /api/admin/sync).

INSERT OR IGNORE INTO posts (
  id, channel_id, channel_slug, channel_name, telegram_message_id, telegram_url,
  title, slug, excerpt, content, published_at, reading_minutes, tags, status
) VALUES
  (
    '00000000-0000-4000-8000-000000000001', 'ch_rhapsody_of_realities', 'rhapsody-of-realities', 'Rhapsody of Realities',
    90001, 'https://t.me/rhapsody_of_realities/90001',
    'Walking In The Reality Of The New Creation', 'walking-in-the-reality-of-the-new-creation-90001',
    'When you understand who you are in Christ, fear loses its grip. Doubt cannot stand where the Word has spoken.',
    'The new creation is a divine masterpiece, born of the Spirit and shaped by the Word. To walk in this reality is to recognise that the old has truly passed away.

When you understand who you are in Christ, fear loses its grip. Doubt cannot stand where the Word has spoken.

Today, refuse every thought that contradicts the truth of your identity. You are not who circumstances say you are; you are who the Word says you are.',
    strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-1 hour'), 1, '["devotional","faith","identity","rhapsody-of-realities"]', 'published'
  ),
  (
    '00000000-0000-4000-8000-000000000002', 'ch_rhapsody_of_realities', 'rhapsody-of-realities', 'Rhapsody of Realities',
    90002, 'https://t.me/rhapsody_of_realities/90002',
    'The Power Of A Renewed Mind', 'the-power-of-a-renewed-mind-90002',
    'A renewed mind sees opportunity where others see obstacles.',
    'Transformation begins in the mind. As you saturate your thoughts in the Word, your perspective shifts and your decisions follow.

A renewed mind sees opportunity where others see obstacles.

Make meditation on the Word your daily practice — and watch divine wisdom direct your steps.',
    strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-25 hours'), 1, '["devotional","growth","rhapsody-of-realities"]', 'published'
  ),
  (
    '00000000-0000-4000-8000-000000000003', 'ch_pastor_chris_teachings', 'pastor-chris-teachings', 'Pastor Chris Teachings',
    90010, 'https://t.me/PastorChrisOyakhilomeMessageText/90010',
    'Understanding The Place Of The Word', 'understanding-the-place-of-the-word-90010',
    'The Word of God is not a collection of nice sayings. It is the active, creative force that frames our world.',
    'The Word of God is not a collection of nice sayings. It is the active, creative force that frames our world.

When you give the Word first place, you give God first place.

Learn to speak it, declare it, and live it — and the results will be undeniable.',
    strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 days'), 1, '["teaching","word","pastor-chris-teachings"]', 'published'
  ),
  (
    '00000000-0000-4000-8000-000000000004', 'ch_pastor_chris_books', 'pastor-chris-books', 'Pastor Chris Books',
    90020, 'https://t.me/pastorchrisbooks/90020',
    'Excerpt — How To Make Your Faith Work', 'excerpt-how-to-make-your-faith-work-90020',
    'Faith is not wishful thinking. It is the substance and the evidence — the title deed of the unseen.',
    'Faith is not wishful thinking. It is the substance and the evidence — the title deed of the unseen.

Your faith works when it rests on what God has said.

This chapter unpacks the simple, scriptural keys to making your faith deliver consistent results.',
    strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-3 days'), 1, '["book","faith","pastor-chris-books"]', 'published'
  ),
  (
    '00000000-0000-4000-8000-000000000005', 'ch_rhapsody_library', 'rhapsody-library', 'Rhapsody of Realities Library',
    90030, 'https://t.me/rhapsodylibrary/90030',
    'Featured Edition — Spirit, Soul And Body', 'featured-edition-spirit-soul-and-body-90030',
    'A deep look at the tripartite nature of man and how each part functions in the believer''s walk.',
    'A deep look at the tripartite nature of man and how each part functions in the believer''s walk.

You are a spirit. You have a soul. You live in a body.

Understanding this changes how you pray, study and live.',
    strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-4 days'), 1, '["library","edition","rhapsody-library"]', 'published'
  ),
  (
    '00000000-0000-4000-8000-000000000006', 'ch_classic_gospel_music', 'classic-gospel-music', 'Classic Gospel Music',
    90040, 'https://t.me/classicgospelmusic/90040',
    'Hymn Spotlight — Great Is Thy Faithfulness', 'hymn-spotlight-great-is-thy-faithfulness-90040',
    'A timeless reminder that morning by morning new mercies we see.',
    'A timeless reminder that morning by morning new mercies we see.

This classic continues to lift hearts across generations.

Press play, lift your voice, and let worship reset your day.',
    strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-5 days'), 1, '["music","hymn","classic-gospel-music"]', 'published'
  ),
  (
    '00000000-0000-4000-8000-000000000099', 'ch_rhapsody_of_realities', 'rhapsody-of-realities', 'Rhapsody of Realities',
    90099, 'https://t.me/rhapsody_of_realities/90099',
    'Draft — Upcoming Study Guide', 'draft-upcoming-study-guide-90099',
    'Not yet published; used to exercise the moderation UI locally.',
    'This is a draft post used to exercise moderation workflows in local development.',
    strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-6 days'), 1, '["draft"]', 'draft'
  );

UPDATE channels SET post_count = (
  SELECT COUNT(*) FROM posts WHERE posts.channel_id = channels.id
);
