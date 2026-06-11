'use client';

import { useState, useRef, useEffect } from 'react';
import { C, F } from '@/lib/design-tokens';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export function AssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: messages,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to get response');
      }

      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (error) {
      console.error('Assistant error:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: error instanceof Error ? error.message : 'Sorry, I encountered an error. Please try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedPrompts = [
    'How do I normalize phone numbers?',
    "What's a Grade A duplicate?",
    'How does the merge survivor work?',
    'How do I import a contact list?',
  ];

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt);
  };

  return (
    <>
      {/* Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 18px',
            background: C.indigo,
            color: C.text,
            border: 'none',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: F.sans,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            zIndex: 999,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M10 2C5.58 2 2 5.58 2 10c0 1.85.63 3.55 1.69 4.9L2 18l3.34-1.55C6.67 17.41 8.26 18 10 18c4.42 0 8-3.58 8-8s-3.58-8-8-8z"
              fill="currentColor"
            />
          </svg>
          Ask Refyne
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 380,
            height: 520,
            background: '#1C3654',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 999,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans }}>
              <span style={{ color: C.indigoLt }}>Refyne</span> Assistant
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: C.text3,
                cursor: 'pointer',
                fontSize: 20,
                padding: 0,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {messages.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 13, color: C.text2, marginBottom: 8 }}>
                  Ask me anything about using Refyne:
                </p>
                {suggestedPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestedPrompt(prompt)}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: C.text2,
                      fontSize: 13,
                      fontFamily: F.sans,
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                }}
              >
                {msg.role === 'assistant' && (
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      background: C.indigo,
                      color: C.text,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    R
                  </div>
                )}
                <div
                  style={{
                    padding: '10px 14px',
                    background: msg.role === 'user' ? 'rgba(46,107,168,0.3)' : 'rgba(255,255,255,0.05)',
                    color: C.text,
                    fontSize: 13,
                    lineHeight: 1.5,
                    fontFamily: F.sans,
                    maxWidth: '80%',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    background: C.indigo,
                    color: C.text,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  R
                </div>
                <div
                  style={{
                    padding: '10px 14px',
                    background: 'rgba(255,255,255,0.05)',
                    color: C.text3,
                    fontSize: 13,
                    fontFamily: F.sans,
                  }}
                >
                  Thinking...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: '16px',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              gap: 8,
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about Refyne..."
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '10px 12px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: C.text,
                fontSize: 13,
                fontFamily: F.sans,
                outline: 'none',
              }}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              style={{
                padding: '10px 16px',
                background: input.trim() && !isLoading ? C.indigo : 'rgba(255,255,255,0.1)',
                color: input.trim() && !isLoading ? C.text : C.text3,
                border: 'none',
                cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: F.sans,
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
