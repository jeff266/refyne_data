'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type Suggestion = {
  text: string;
  icon?: string;
};

// Hardcoded fallback suggestions
const DEFAULT_SUGGESTIONS: Suggestion[] = [
  { text: 'How do I normalize phone numbers?', icon: 'Phone' },
  { text: "What's a Grade A duplicate?", icon: 'GitMerge' },
  { text: 'How does the merge survivor work?', icon: 'Shield' },
  { text: 'How do I import a contact list?', icon: 'Upload' },
];

// Animation keyframes
const bounceKeyframes = `
@keyframes bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-8px); }
}
`;

const fadeScaleInKeyframes = `
@keyframes fadeScaleIn {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
`;

const fadeScaleOutKeyframes = `
@keyframes fadeScaleOut {
  from {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  to {
    opacity: 0;
    transform: scale(0.9) translateY(10px);
  }
}
`;

export function AssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>(DEFAULT_SUGGESTIONS);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch dynamic suggestions on mount
  useEffect(() => {
    fetch('/api/assistant/suggestions')
      .then((res) => res.json())
      .then((data) => {
        if (data.suggestions && Array.isArray(data.suggestions)) {
          setSuggestions(data.suggestions);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch suggestions:', err);
        // Keep default suggestions on error
      });
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 180);
  };

  const handleSend = async (suggestionClicked = false) => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setHasError(false);

    // Add empty assistant message immediately
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: messages,
          suggestionClicked,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to get response');
      }

      // Read streaming response
      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let assistantMessage = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode chunk and extract text from SSE events
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'content_block_delta' && data.delta?.text) {
                assistantMessage += data.delta.text;

                // Update last message in real-time
                setMessages(prev => [
                  ...prev.slice(0, -1),
                  { role: 'assistant', content: assistantMessage },
                ]);
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Assistant error:', error);
      setHasError(true);
      setIsLoading(false);

      // Replace empty assistant message with error
      setMessages(prev => [
        ...prev.slice(0, -1),
        {
          role: 'assistant',
          content: error instanceof Error ? error.message : 'Sorry, I encountered an error. Please try again.',
        },
      ]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt);
    // Immediately send when suggestion is clicked
    setTimeout(() => handleSend(true), 0);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: bounceKeyframes + fadeScaleInKeyframes + fadeScaleOutKeyframes }} />

      {/* Trigger Button - Circular */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: C.indigo,
            color: C.text,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            zIndex: 999,
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)';
          }}
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* Chat Panel - Modern with Animations */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 380,
            maxHeight: 'calc(100vh - 100px)',
            background: hasError ? 'rgba(28, 54, 84, 0.95)' : '#1C3654',
            border: hasError ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            zIndex: 999,
            boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
            animation: isClosing ? 'fadeScaleOut 180ms ease-out forwards' : 'fadeScaleIn 180ms ease-out',
            transformOrigin: 'bottom right',
          }}
        >
          {/* Header with Avatar */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: C.indigo,
                color: C.text,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              R
            </div>

            {/* Title and Status */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans }}>
                Refyne Assistant
              </div>
              <div style={{ fontSize: 11, color: C.text3, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: C.green,
                  }}
                />
                Online
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={handleClose}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: 'none',
                color: C.text3,
                cursor: 'pointer',
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              }}
            >
              <X size={16} />
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 13, color: C.text2, marginBottom: 4 }}>
                  Ask me anything about using Refyne:
                </p>
                {suggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestedPrompt(suggestion.text)}
                    style={{
                      textAlign: 'left',
                      padding: '10px 16px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 20,
                      color: C.text2,
                      fontSize: 13,
                      fontFamily: F.sans,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {suggestion.text}
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
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
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
                    padding: '11px 15px',
                    background: msg.role === 'user' ? 'rgba(46,107,168,0.4)' : 'rgba(255,255,255,0.08)',
                    color: C.text,
                    fontSize: 13,
                    lineHeight: 1.5,
                    fontFamily: F.sans,
                    maxWidth: '75%',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    // Asymmetric border-radius (iMessage style)
                    borderRadius:
                      msg.role === 'user'
                        ? '18px 18px 4px 18px' // User: sharp bottom-right
                        : '18px 18px 18px 4px', // Assistant: sharp bottom-left
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          {/* Input - Pill-shaped */}
          <div
            style={{
              padding: '16px',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              gap: 10,
              alignItems: 'center',
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
                padding: '12px 18px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 24,
                color: C.text,
                fontSize: 13,
                fontFamily: F.sans,
                outline: 'none',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: input.trim() && !isLoading ? C.indigo : 'rgba(255,255,255,0.1)',
                color: input.trim() && !isLoading ? C.text : C.text3,
                border: 'none',
                cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (input.trim() && !isLoading) {
                  e.currentTarget.style.transform = 'scale(1.05)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
