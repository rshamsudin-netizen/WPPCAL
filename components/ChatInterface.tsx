'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import MessageBubble from './MessageBubble';
import InputBar from './InputBar';
import type { ChatMessage, APIHistoryMessage } from '@/lib/types';

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hey! I'm your calorie tracking assistant.\n\nSend me a photo of any meal and I'll identify what's in it, confirm the items with you, and log the calories.\n\nYou can also ask me things like:\n• \"What are my calories today?\"\n• \"What did I eat this week?\"\n• \"How many calories do I have left?\"\n• \"Can I still eat a burger?\"",
  timestamp: new Date(),
};

async function compressImage(
  file: File,
  maxWidth = 1280,
  quality = 0.85
): Promise<{ base64: string; mimeType: string; url: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas not supported'));
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64 = dataUrl.split(',')[1];
        resolve({ base64, mimeType: 'image/jpeg', url: dataUrl });
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<{
    url: string;
    base64: string;
    mimeType: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const getAPIHistory = (): APIHistoryMessage[] => {
    return messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role, content: m.content }));
  };

  const handleSend = async (text: string) => {
    if (!text && !pendingImage) return;

    setError(null);

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text || '',
      imageUrl: pendingImage?.url,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const capturedImage = pendingImage;
    setPendingImage(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: getAPIHistory(),
          message: text || 'What is this food? Please help me track it.',
          image: capturedImage?.base64,
          imageMimeType: capturedImage?.mimeType,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to get a response.');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Oops — ${message}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageSelect = async (file: File) => {
    try {
      const compressed = await compressImage(file);
      setPendingImage(compressed);
    } catch {
      setError('Failed to process the image. Please try again.');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-wa-bg">
      {/* ── Header ── */}
      <header className="bg-wa-green text-white px-4 py-3 flex items-center gap-3 shadow-md z-10 flex-shrink-0">
        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl select-none">
          🥗
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-[15px] leading-tight">Calorie Tracker</h1>
          <p className="text-[11px] text-white/70 leading-tight">Powered by Claude</p>
        </div>
        {/* Calories today indicator (decorative) */}
        <div className="text-[11px] text-white/70 text-right leading-tight hidden sm:block">
          <p>Ask me anything</p>
          <p>about your nutrition</p>
        </div>
      </header>

      {/* ── Chat background pattern ── */}
      <div
        className="absolute inset-0 top-[64px] pointer-events-none opacity-[0.04] z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cpath d='M10 10h5v5h-5zm15 0h5v5h-5zm15 0h5v5h-5zM2.5 25h5v5h-5zm15 0h5v5h-5zm15 0h5v5h-5zm15 0h5v5h-5zM10 40h5v5h-5zm15 0h5v5h-5zm15 0h5v5h-5z' fill='%23000'/%3E%3C/svg%3E")`,
        }}
      />

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-3 pt-4 pb-2 z-10 relative">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex justify-start mb-2">
            <div className="w-2 h-2 rounded-full bg-wa-green mt-4 mr-1 flex-shrink-0 self-start" />
            <div className="bg-white rounded-2xl rounded-tl-none shadow-sm border border-gray-100 px-4 py-3 flex gap-1.5 items-center">
              <span
                className="w-2 h-2 bg-gray-400 rounded-full inline-block"
                style={{ animation: 'bounce 1.2s infinite ease-in-out', animationDelay: '0s' }}
              />
              <span
                className="w-2 h-2 bg-gray-400 rounded-full inline-block"
                style={{ animation: 'bounce 1.2s infinite ease-in-out', animationDelay: '0.2s' }}
              />
              <span
                className="w-2 h-2 bg-gray-400 rounded-full inline-block"
                style={{ animation: 'bounce 1.2s infinite ease-in-out', animationDelay: '0.4s' }}
              />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} className="h-1" />
      </div>

      {/* ── Pending Image Preview ── */}
      {pendingImage && (
        <div className="z-10 bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <div className="relative">
            <img
              src={pendingImage.url}
              alt="Selected meal"
              className="w-16 h-16 object-cover rounded-xl shadow-sm"
            />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-wa-green rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="white" className="w-2.5 h-2.5">
                <path d="M10.28 2.28L4 8.56 1.72 6.28a1 1 0 00-1.41 1.41l3 3a1 1 0 001.41 0l7-7a1 1 0 00-1.41-1.41z" />
              </svg>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-wa-text">Photo ready to send</p>
            <p className="text-[11px] text-wa-text-muted">Add a caption or send as is</p>
          </div>
          <button
            onClick={() => setPendingImage(null)}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors flex-shrink-0"
            title="Remove photo"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Error Banner ── */}
      {error && !isLoading && (
        <div className="z-10 bg-red-50 border-t border-red-100 px-4 py-2 flex items-center justify-between flex-shrink-0">
          <p className="text-[12px] text-red-600">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600 text-xs ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Input Bar ── */}
      <div className="z-10 flex-shrink-0">
        <InputBar
          onSend={handleSend}
          onImageSelect={handleImageSelect}
          disabled={isLoading}
          hasPendingImage={!!pendingImage}
        />
      </div>
    </div>
  );
}
