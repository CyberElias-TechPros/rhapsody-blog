import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Prose } from './Prose';

describe('Prose', () => {
  it('renders headings, paragraphs and quotes', () => {
    render(<Prose content={'## Study\n\nRead verse.\n\n> Be transformed'} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Study');
    expect(screen.getByText('Read verse.')).toBeInTheDocument();
    expect(screen.getByRole('blockquote')).toHaveTextContent('Be transformed');
  });

  it('renders inline markdown without HTML injection', () => {
    const { container } = render(
      <Prose content={'**bold** *it* `code` <script>alert(1)</script> [link](https://example.com)'} />
    );
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText('bold').tagName).toBe('STRONG');
    expect(screen.getByText('it').tagName).toBe('EM');
    expect(screen.getByText('code').tagName).toBe('CODE');
    expect(container).toHaveTextContent('<script>alert(1)</script>');
    const link = screen.getByRole('link', { name: 'link' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('never renders a javascript: link even when embedded in content', () => {
    const { container } = render(<Prose content={'[evil](javascript:alert(1))'} />);
    expect(container.querySelector('a')).toBeNull();
    expect(container).toHaveTextContent('[evil](javascript:alert(1))');
  });
});
