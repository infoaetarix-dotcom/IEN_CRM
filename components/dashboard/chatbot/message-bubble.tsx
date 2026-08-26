import { cn } from '@/lib/utils';

export function MessageBubble({
  role,
  content,
}: {
  role: 'user' | 'assistant';
  content: string;
}) {
  const isUser = role === 'user';
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed',
          isUser
            ? 'bg-tenant-accent text-white'
            : 'border border-marketing-ink/10 bg-white text-marketing-ink',
        )}
      >
        {content}
      </div>
    </div>
  );
}
