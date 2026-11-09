import * as React from 'react';
import { cn } from '../utils/cn';

export interface StreamTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** The full text received so far. New trailing text animates in. */
  text: string;
  /** Set false to render the text without the entrance animation. */
  animate?: boolean;
}

/**
 * Renders incrementally-arriving assistant text.
 *
 * Only the newly appended segment is animated. Animating the whole string on
 * every token would restart the effect dozens of times per second and make the
 * output unreadable — the opposite of what streaming is for.
 *
 * The component is intentionally dumb about Markdown: it splits at the last
 * safe boundary so a partially-received token is never re-rendered mid-way.
 */
export function StreamText({ text, animate = true, className, ...props }: StreamTextProps): React.ReactElement {
  const previousRef = React.useRef('');
  const [settled, setSettled] = React.useState(text);
  const [incoming, setIncoming] = React.useState('');

  React.useEffect(() => {
    const previous = previousRef.current;
    if (!animate || !text.startsWith(previous)) {
      // A rewritten prefix (a new message, or an edit) is not an append:
      // replace wholesale instead of pretending it streamed.
      setSettled(text);
      setIncoming('');
      previousRef.current = text;
      return;
    }
    setSettled(previous);
    setIncoming(text.slice(previous.length));
    previousRef.current = text;
  }, [text, animate]);

  return (
    <span className={cn('whitespace-pre-wrap', className)} {...props}>
      {settled}
      {incoming ? <span className="ai-stream-in">{incoming}</span> : null}
    </span>
  );
}
