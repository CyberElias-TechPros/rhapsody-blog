import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SITE_VERIFICATION } from '@/lib/site';

/**
 * Third-party services check domain ownership by fetching the home page and looking for their
 * `<meta name=… content=…>` in its `<head>`, or by fetching a file from the site root. They
 * re-check later, so a proof removed by a careless edit un-verifies the domain with no error
 * anywhere. Both forms are covered here.
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('site verification', () => {
  it('publishes the Okecbot code as a meta tag value and as /okecbot-verification.txt', () => {
    const code = SITE_VERIFICATION['okecbot-site-verification'];
    expect(code).toMatch(/^okb-[a-z0-9]+$/);
    // The file must contain "just the code". A trailing newline or a BOM from an editor makes
    // an exact-match check fail, so the bytes are compared exactly, not trimmed.
    expect(read('public/okecbot-verification.txt')).toBe(code);
  });

  it('renders every proof as a plain <meta> inside the root layout <head>', () => {
    const layout = read('app/layout.tsx');
    const head = layout.slice(layout.indexOf('<head>'), layout.indexOf('</head>'));
    expect(head).toContain('Object.entries(SITE_VERIFICATION)');
    expect(head).toContain('<meta key={name} name={name} content={content} />');
    // Not also through `metadata.verification`. On the dynamic home page Next can stream those
    // tags into <body>, and having both would emit every tag twice.
    expect(layout).not.toMatch(/\bverification\s*:/);
  });
});
