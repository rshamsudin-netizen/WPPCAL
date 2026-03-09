'use client';

import { useState, useRef, KeyboardEvent } from 'react';

interface InputBarProps {
  onSend: (text: string) => void;
  onImageSelect: (file: File) => void;
  disabled?: boolean;
  hasPendingImage?: boolean;
}

export default function InputBar({ onSend, onImageSelect, disabled, hasPendingImage }: InputBarProps) {
  const [text, setText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = (text.trim().length > 0 || !!hasPendingImage) && !disabled;

  const handleSend = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageSelect(file);
      e.target.value = '';
    }
  };

  return (
    <div className="bg-wa-input-bg px-3 py-2.5 flex items-end gap-2 border-t border-gray-200">
      {/* Camera / attach button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        title="Attach a photo"
        className={`
          flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors
          ${disabled
            ? 'text-gray-300 cursor-not-allowed'
            : hasPendingImage
            ? 'bg-wa-green text-white'
            : 'text-wa-text-muted hover:text-wa-green hover:bg-wa-green/10'
          }
        `}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <path d="M12 9a3.75 3.75 0 100 7.5A3.75 3.75 0 0012 9z" />
          <path
            fillRule="evenodd"
            d="M9.344 3.071a49.52 49.52 0 015.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 01-3 3h-15a3 3 0 01-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 001.11-.71l.822-1.315a2.942 2.942 0 012.332-1.39zM12 7.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Text input */}
      <div className="flex-1 bg-white rounded-2xl border border-gray-200 px-4 py-2 flex items-end min-h-[40px]">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={hasPendingImage ? 'Add a caption (optional)…' : 'Message'}
          disabled={disabled}
          rows={1}
          className="w-full resize-none bg-transparent text-[13.5px] text-wa-text placeholder-wa-text-muted focus:outline-none leading-5 max-h-[120px] overflow-y-auto disabled:opacity-60"
        />
      </div>

      {/* Send button */}
      <button
        onClick={handleSend}
        disabled={!canSend}
        title="Send"
        className={`
          flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all
          ${canSend
            ? 'bg-wa-green text-white shadow-sm hover:bg-wa-green-dark active:scale-95'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }
        `}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 translate-x-0.5">
          <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
        </svg>
      </button>
    </div>
  );
}
