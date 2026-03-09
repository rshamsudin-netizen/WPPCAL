'use client';

import { ChatMessage } from '@/lib/types';

interface MessageBubbleProps {
  message: ChatMessage;
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function parseMessageContent(content: string) {
  // Detect if this is a nutrition summary line (contains kcal and macro info)
  const isNutritionHeavy =
    content.includes('kcal') &&
    (content.includes('Protein:') || content.includes('P:')) &&
    content.includes('|');

  return { isNutritionHeavy };
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const { isNutritionHeavy } = parseMessageContent(message.content);

  // Format line breaks and bold text (**text**)
  const formatText = (text: string) => {
    return text.split('\n').map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={i}>
          {parts.map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={j}>{part.slice(2, -2)}</strong>;
            }
            return <span key={j}>{part}</span>;
          })}
          {i < text.split('\n').length - 1 && <br />}
        </span>
      );
    });
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-1`}>
      {/* Assistant avatar dot */}
      {!isUser && (
        <div className="w-2 h-2 rounded-full bg-wa-green mt-4 mr-1 flex-shrink-0 self-start" />
      )}

      <div
        className={`
          relative max-w-[78%] rounded-2xl shadow-sm px-3.5 py-2.5
          ${isUser
            ? 'bg-wa-bubble-out rounded-tr-none'
            : 'bg-wa-bubble-in rounded-tl-none border border-gray-100'
          }
          ${isNutritionHeavy ? 'min-w-[220px]' : ''}
        `}
      >
        {/* Image (if user sent one) */}
        {message.imageUrl && (
          <div className="mb-2 -mx-0.5">
            <img
              src={message.imageUrl}
              alt="Meal photo"
              className="w-full max-w-[260px] rounded-xl object-cover max-h-64"
            />
          </div>
        )}

        {/* Message text */}
        {message.content && (
          <p className="text-[13.5px] leading-[1.45] text-wa-text whitespace-pre-wrap break-words">
            {formatText(message.content)}
          </p>
        )}

        {/* Timestamp */}
        <p
          className={`text-[10px] mt-1 select-none ${
            isUser ? 'text-right text-green-700/60' : 'text-right text-wa-text-muted'
          }`}
        >
          {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}
