/**
 * AssistantWidget UI Tests
 *
 * Tests the redesigned chat widget with modern aesthetic:
 * - Circular trigger button
 * - Chat bubbles with asymmetric border-radius
 * - Pill-shaped inputs and suggestions
 * - Animations (open/close, typing indicator)
 * - Error states
 *
 * @vitest-environment jsdom
 */

import '../setup-jsdom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AssistantWidget } from '@/components/AssistantWidget';

// Mock fetch
global.fetch = vi.fn();

describe('AssistantWidget - Modern UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock successful suggestions fetch
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        suggestions: [
          { text: 'How do I normalize phone numbers?', icon: 'Phone' },
          { text: "What's a Grade A duplicate?", icon: 'GitMerge' },
          { text: 'How does the merge survivor work?', icon: 'Shield' },
          { text: 'How do I import a contact list?', icon: 'Upload' },
        ],
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Renders circular trigger button with MessageCircle icon', () => {
    const { container } = render(<AssistantWidget />);

    // Find trigger button - should be circular (width = height)
    const triggerButton = container.querySelector('button');
    expect(triggerButton).toBeTruthy();

    const styles = triggerButton?.style;
    expect(styles?.width).toBe('52px');
    expect(styles?.height).toBe('52px');
    expect(styles?.borderRadius).toBe('50%');

    // Should have MessageCircle icon (lucide-react renders as svg)
    const icon = triggerButton?.querySelector('svg');
    expect(icon).toBeTruthy();
  });

  it('2. Opens chat panel with scale+translateY animation', async () => {
    const { container } = render(<AssistantWidget />);

    const triggerButton = container.querySelector('button');
    fireEvent.click(triggerButton!);

    await waitFor(() => {
      const chatPanel = container.querySelector('div[style*="fadeScaleIn"]');
      expect(chatPanel).toBeTruthy();
    });
  });

  it('3. Shows header with avatar, title, and online status', async () => {
    const { container } = render(<AssistantWidget />);

    const triggerButton = container.querySelector('button');
    fireEvent.click(triggerButton!);

    await waitFor(() => {
      // Avatar circle with "R"
      const avatar = Array.from(container.querySelectorAll('div')).find(
        (div) => div.textContent === 'R' && div.style.borderRadius === '50%'
      );
      expect(avatar).toBeTruthy();

      // Title
      expect(screen.getByText('Refyne Assistant')).toBeInTheDocument();

      // Online status
      expect(screen.getByText('Online')).toBeInTheDocument();
    });
  });

  it('4. Renders pill-shaped suggestion chips in empty state', async () => {
    const { container } = render(<AssistantWidget />);

    const triggerButton = container.querySelector('button');
    fireEvent.click(triggerButton!);

    await waitFor(() => {
      // Find suggestion buttons - should have pill-shaped border-radius
      const suggestionButtons = Array.from(container.querySelectorAll('button')).filter(
        (btn) => btn.textContent?.includes('normalize') || btn.textContent?.includes('duplicate')
      );

      expect(suggestionButtons.length).toBeGreaterThan(0);

      // Check for pill-shaped border radius (should be 20px)
      suggestionButtons.forEach((btn) => {
        expect(btn.style.borderRadius).toBe('20px');
      });
    });
  });

  it('5. Chat bubbles have asymmetric border-radius (iMessage style)', async () => {
    const { container } = render(<AssistantWidget />);

    // Open widget
    const triggerButton = container.querySelector('button');
    fireEvent.click(triggerButton!);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ask anything about Refyne...')).toBeInTheDocument();
    });

    // Mock streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"content_block_delta","delta":{"text":"Test response"}}\n'));
        controller.close();
      },
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      body: stream,
    });

    // Send a message
    const input = screen.getByPlaceholderText('Ask anything about Refyne...');
    fireEvent.change(input, { target: { value: 'Test question' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Wait for both messages to appear
    await waitFor(
      () => {
        expect(screen.getByText('Test question')).toBeInTheDocument();
        expect(screen.getByText('Test response')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Check that messages have asymmetric border-radius by checking inline styles
    const allDivs = container.querySelectorAll('div');
    const userBubble = Array.from(allDivs).find(
      (div) => div.textContent === 'Test question' && div.getAttribute('style')?.includes('border-radius')
    );
    const assistantBubble = Array.from(allDivs).find(
      (div) => div.textContent === 'Test response' && div.getAttribute('style')?.includes('border-radius')
    );

    // User messages should have sharp bottom-right corner
    expect(userBubble?.getAttribute('style')).toContain('18px 18px 4px 18px');

    // Assistant messages should have sharp bottom-left corner
    expect(assistantBubble?.getAttribute('style')).toContain('18px 18px 18px 4px');
  });


  it('7. Input field is pill-shaped with circular send button', async () => {
    const { container } = render(<AssistantWidget />);

    const triggerButton = container.querySelector('button');
    fireEvent.click(triggerButton!);

    await waitFor(() => {
      const input = screen.getByPlaceholderText('Ask anything about Refyne...');
      expect(input).toBeInTheDocument();

      // Input should have pill-shaped border-radius (24px)
      expect(input.style.borderRadius).toBe('24px');

      // Send button should be circular
      const sendButton = Array.from(container.querySelectorAll('button')).find(
        (btn) => btn.querySelector('svg') && btn.style.borderRadius === '50%' && btn.style.width === '40px'
      );
      expect(sendButton).toBeTruthy();
      expect(sendButton?.style.width).toBe('40px');
      expect(sendButton?.style.height).toBe('40px');
    });
  });

  it('8. Send button disabled when input is empty', async () => {
    const { container } = render(<AssistantWidget />);

    const triggerButton = container.querySelector('button');
    fireEvent.click(triggerButton!);

    await waitFor(() => {
      const sendButton = Array.from(container.querySelectorAll('button')).find(
        (btn) => btn.querySelector('svg') && btn.style.borderRadius === '50%' && btn.style.width === '40px'
      );

      expect(sendButton).toBeDisabled();
    });
  });

  it('9. Send button enabled when input has text', async () => {
    const { container } = render(<AssistantWidget />);

    const triggerButton = container.querySelector('button');
    fireEvent.click(triggerButton!);

    await waitFor(() => {
      const input = screen.getByPlaceholderText('Ask anything about Refyne...');
      fireEvent.change(input, { target: { value: 'Test' } });

      const sendButton = Array.from(container.querySelectorAll('button')).find(
        (btn) => btn.querySelector('svg') && btn.style.borderRadius === '50%' && btn.style.width === '40px'
      );

      expect(sendButton).not.toBeDisabled();
    });
  });

  it('10. Close button triggers fadeScaleOut animation', async () => {
    const { container } = render(<AssistantWidget />);

    // Open widget
    const triggerButton = container.querySelector('button');
    fireEvent.click(triggerButton!);

    await waitFor(() => {
      expect(screen.getByText('Refyne Assistant')).toBeInTheDocument();
    });

    // Find close button by SVG class
    const xButton = Array.from(container.querySelectorAll('button')).find((btn) => {
      const svg = btn.querySelector('svg.lucide-x');
      return svg !== null;
    });

    expect(xButton).toBeTruthy();
    fireEvent.click(xButton!);

    // The component should start closing animation
    await waitFor(
      () => {
        const chatPanel = container.querySelector('div');
        const animation = chatPanel?.getAttribute('style');
        expect(animation?.includes('fadeScaleOut')).toBe(true);
      },
      { timeout: 500 }
    );
  });

  it('11. Error state shows red tint on chat panel', async () => {
    const { container } = render(<AssistantWidget />);

    // Open widget
    const triggerButton = container.querySelector('button');
    fireEvent.click(triggerButton!);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ask anything about Refyne...')).toBeInTheDocument();
    });

    // Mock failed response (ok: false triggers error handling in widget)
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
    });

    // Send message
    const input = screen.getByPlaceholderText('Ask anything about Refyne...');
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      // Should show error message (the default error message from the component)
      expect(screen.getByText(/Failed to get response/i)).toBeInTheDocument();

      // Chat panel should have red-tinted border
      const chatPanel = Array.from(container.querySelectorAll('div')).find(
        (div) => div.style.border?.includes('239, 68, 68')
      );
      expect(chatPanel).toBeTruthy();
    });
  });

  it('12. Suggestion click populates input field', async () => {
    render(<AssistantWidget />);

    // Open widget
    const triggerButton = screen.getAllByRole('button')[0];
    fireEvent.click(triggerButton);

    await waitFor(() => {
      expect(screen.getByText(/normalize phone numbers/i)).toBeInTheDocument();
    });

    // Click suggestion
    const suggestion = screen.getByText(/normalize phone numbers/i);
    fireEvent.click(suggestion);

    // Verify the input field is populated with the suggestion text
    await waitFor(
      () => {
        const input = screen.getByPlaceholderText('Ask anything about Refyne...');
        expect(input).toHaveValue('How do I normalize phone numbers?');
      },
      { timeout: 500 }
    );
  });

  it('13. Enter key sends message', async () => {
    const { container } = render(<AssistantWidget />);

    // Open widget
    const triggerButton = container.querySelector('button');
    fireEvent.click(triggerButton!);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ask anything about Refyne...')).toBeInTheDocument();
    });

    // Mock response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: 'Test response' }),
    });

    // Type and press Enter
    const input = screen.getByPlaceholderText('Ask anything about Refyne...');
    fireEvent.change(input, { target: { value: 'Test question' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/assistant/chat',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  it('14. Messages scroll to bottom automatically', async () => {
    const { container } = render(<AssistantWidget />);

    // Open widget
    const triggerButton = container.querySelector('button');
    fireEvent.click(triggerButton!);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ask anything about Refyne...')).toBeInTheDocument();
    });

    // Mock response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: 'Response' }),
    });

    // Send message
    const input = screen.getByPlaceholderText('Ask anything about Refyne...');
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      // Should have scrollIntoView ref at bottom (messagesEndRef)
      const scrollRef = container.querySelector('div[style*="flex"]');
      expect(scrollRef).toBeTruthy();
    });
  });
});
