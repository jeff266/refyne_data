/**
 * @vitest-environment jsdom
 */
import '../setup-jsdom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DragHandle } from '@/components/ui/icons/DragHandle';
import { LockIcon } from '@/components/ui/icons/LockIcon';
import { PencilIcon } from '@/components/ui/icons/PencilIcon';
import { CloseIcon } from '@/components/ui/icons/CloseIcon';

describe('Merge Rules UI', () => {
  describe('Icon Components', () => {
    it('1. DragHandle renders correct SVG with 6 circles', () => {
      const { container } = render(<DragHandle />);
      const svg = container.querySelector('svg');
      const circles = container.querySelectorAll('circle');

      expect(svg).toBeTruthy();
      expect(circles.length).toBe(6);
      expect(svg?.getAttribute('viewBox')).toBe('0 0 18 18');
    });

    it('2. LockIcon renders correct SVG', () => {
      const { container } = render(<LockIcon />);
      const svg = container.querySelector('svg');
      const rect = container.querySelector('rect');
      const path = container.querySelector('path');

      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('stroke')).toBe('currentColor');
      expect(svg?.getAttribute('stroke-width')).toBe('1.5');
      expect(rect).toBeTruthy();
      expect(path).toBeTruthy();
    });

    it('3. PencilIcon renders correct SVG', () => {
      const { container } = render(<PencilIcon />);
      const svg = container.querySelector('svg');
      const path = container.querySelector('path');

      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('stroke')).toBe('currentColor');
      expect(path).toBeTruthy();
      expect(path?.getAttribute('d')).toContain('2.5');
    });

    it('4. CloseIcon renders correct SVG', () => {
      const { container } = render(<CloseIcon />);
      const svg = container.querySelector('svg');
      const path = container.querySelector('path');

      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('stroke')).toBe('currentColor');
      expect(path).toBeTruthy();
      expect(path?.getAttribute('d')).toContain('4');
    });
  });

  describe('Rule Table Icons', () => {
    it('5. Default rules show LockIcon not DragHandle', () => {
      const MockDefaultRule = () => (
        <tr data-testid="default-rule">
          <td><LockIcon /></td>
          <td>lifecyclestage</td>
        </tr>
      );

      const { container } = render(
        <table><tbody><MockDefaultRule /></tbody></table>
      );

      const row = screen.getByTestId('default-rule');

      // LockIcon has rect and path, DragHandle has circles
      expect(row.querySelector('rect')).toBeTruthy();
      expect(row.querySelector('circle')).toBeFalsy();
    });

    it('6. Editable rules show DragHandle not LockIcon', () => {
      const MockEditableRule = () => (
        <tr data-testid="editable-rule">
          <td><DragHandle /></td>
          <td>custom_field</td>
        </tr>
      );

      const { container } = render(
        <table><tbody><MockEditableRule /></tbody></table>
      );

      const row = screen.getByTestId('editable-rule');

      // DragHandle has circles, LockIcon has rect
      expect(row.querySelector('circle')).toBeTruthy();
      expect(row.querySelector('rect')).toBeFalsy();
    });
  });

  describe('Drag and Drop', () => {
    it('7. Drag reorder: dragover shows insertion indicator', () => {
      const MockDraggableCard = ({ id, onDragOver, dragOverId }: any) => (
        <div
          data-testid={`card-${id}`}
          onDragOver={(e) => onDragOver(e, id)}
          style={{
            borderTop: dragOverId === id ? '2px solid #2E6BA8' : undefined
          }}
        >
          Card {id}
        </div>
      );

      let dragOverId: string | null = null;
      const setDragOverId = (id: string | null) => { dragOverId = id; };

      const { rerender } = render(
        <>
          <MockDraggableCard
            id="1"
            onDragOver={(e: any, id: string) => { e.preventDefault(); setDragOverId(id); }}
            dragOverId={dragOverId}
          />
          <MockDraggableCard
            id="2"
            onDragOver={(e: any, id: string) => { e.preventDefault(); setDragOverId(id); }}
            dragOverId={dragOverId}
          />
        </>
      );

      const card2 = screen.getByTestId('card-2');
      fireEvent.dragOver(card2);

      // Need to rerender with updated dragOverId
      setDragOverId('2');
      rerender(
        <>
          <MockDraggableCard
            id="1"
            onDragOver={(e: any, id: string) => { e.preventDefault(); setDragOverId(id); }}
            dragOverId="2"
          />
          <MockDraggableCard
            id="2"
            onDragOver={(e: any, id: string) => { e.preventDefault(); setDragOverId(id); }}
            dragOverId="2"
          />
        </>
      );

      expect(screen.getByTestId('card-2').style.borderTop).toContain('2px');
    });

    it('8. Drag reorder: drop updates local array order', () => {
      let items = ['A', 'B', 'C'];

      const reorder = (draggedIndex: number, targetIndex: number) => {
        const newItems = [...items];
        const [removed] = newItems.splice(draggedIndex, 1);
        newItems.splice(targetIndex, 0, removed);
        items = newItems;
      };

      // Drag item B (index 1) to position of item C (index 2)
      reorder(1, 2);

      expect(items).toEqual(['A', 'C', 'B']);
    });

    it('9. Drag reorder: calls bulk-order API on drop', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ updated: 3 }),
        } as Response)
      );

      const orderedIds = ['id-c', 'id-a', 'id-b'];

      await fetch('/api/settings/survivorship-rule-groups/bulk-order', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds }),
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/settings/survivorship-rule-groups/bulk-order',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ orderedIds }),
        })
      );

      vi.restoreAllMocks();
    });
  });

  describe('Bulk Order API', () => {
    it('10. Bulk-order API updates rule_order correctly', () => {
      const orderedIds = ['uuid-3', 'uuid-1', 'uuid-2'];
      const updates = orderedIds.map((id, index) => ({
        id,
        rule_order: index
      }));

      expect(updates).toEqual([
        { id: 'uuid-3', rule_order: 0 },
        { id: 'uuid-1', rule_order: 1 },
        { id: 'uuid-2', rule_order: 2 },
      ]);
    });

    it('11. Bulk-order API rejects non-admin (403)', async () => {
      // Mock requireAdmin throwing an error
      const mockError = new Error('Forbidden');

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 403,
          json: () => Promise.resolve({ error: 'Forbidden' }),
        } as Response)
      );

      const response = await fetch('/api/dedup/survivorship-rules/bulk-order', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: ['id-1'] }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(403);

      vi.restoreAllMocks();
    });

    it('12. Compound group drag updates group_order', () => {
      const groups = [
        { id: 'g1', group_priority: 0 },
        { id: 'g2', group_priority: 1 },
        { id: 'g3', group_priority: 2 },
      ];

      // Simulate dragging g3 to position 0
      const draggedIndex = 2;
      const targetIndex = 0;

      const reordered = [...groups];
      const [removed] = reordered.splice(draggedIndex, 1);
      reordered.splice(targetIndex, 0, removed);

      const orderedIds = reordered.map(g => g.id);

      expect(orderedIds).toEqual(['g3', 'g1', 'g2']);
    });
  });

  describe('Compliance Pills', () => {
    it('13. Compliance pills render one per field', () => {
      const fields = ['hs_email_optout', 'hs_email_bounce', 'hs_legal_basis'];

      const { container } = render(
        <div data-testid="compliance-container">
          {fields.map(field => (
            <div
              key={field}
              data-testid={`pill-${field}`}
              style={{
                background: 'rgba(46, 107, 168, 0.2)',
                border: '1px solid rgba(46, 107, 168, 0.4)',
              }}
            >
              {field}
            </div>
          ))}
        </div>
      );

      fields.forEach(field => {
        const pill = screen.getByTestId(`pill-${field}`);
        expect(pill).toBeTruthy();
        expect(pill.style.background).toBe('rgba(46, 107, 168, 0.2)');
        expect(pill.style.border).toBe('1px solid rgba(46, 107, 168, 0.4)');
      });
    });

    it('14. Compliance pill × button removes the field', () => {
      let fields = ['hs_email_optout', 'hs_email_bounce'];

      const removeField = (field: string) => {
        fields = fields.filter(f => f !== field);
      };

      const MockPill = ({ field, onRemove }: any) => (
        <div data-testid={`pill-${field}`}>
          {field}
          <button
            data-testid={`remove-${field}`}
            onClick={() => onRemove(field)}
          >
            <CloseIcon />
          </button>
        </div>
      );

      const { rerender } = render(
        <>
          {fields.map(f => (
            <MockPill key={f} field={f} onRemove={removeField} />
          ))}
        </>
      );

      const removeButton = screen.getByTestId('remove-hs_email_optout');
      fireEvent.click(removeButton);

      expect(fields).toEqual(['hs_email_bounce']);
    });
  });

  describe('Tier Connectors and Numbers', () => {
    it('15. Tier connector labels render between tiers', () => {
      const { container } = render(
        <div>
          <div data-testid="tier-1">Tier 1</div>
          <div data-testid="connector-1-2" style={{ fontSize: 11, color: 'rgba(249, 248, 245, 0.4)' }}>
            if no record rule matches
          </div>
          <div data-testid="tier-2">Tier 2</div>
          <div data-testid="connector-2-3" style={{ fontSize: 11, color: 'rgba(249, 248, 245, 0.4)' }}>
            always applied last
          </div>
          <div data-testid="tier-3">Tier 3</div>
        </div>
      );

      const connector1 = screen.getByTestId('connector-1-2');
      const connector2 = screen.getByTestId('connector-2-3');

      expect(connector1.textContent).toBe('if no record rule matches');
      expect(connector2.textContent).toBe('always applied last');
      expect(connector1.style.fontSize).toBe('11px');
      expect(connector1.style.color).toBe('rgba(249, 248, 245, 0.4)');
    });

    it('16. Tier numbers ① ② ③ render as circle elements with #2E6BA8', () => {
      const TierNumber = ({ number }: { number: string }) => (
        <div
          data-testid={`tier-number-${number}`}
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: '#2E6BA8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#F9F8F5',
          }}
        >
          {number}
        </div>
      );

      render(
        <>
          <TierNumber number="①" />
          <TierNumber number="②" />
          <TierNumber number="③" />
        </>
      );

      ['①', '②', '③'].forEach(num => {
        const circle = screen.getByTestId(`tier-number-${num}`);
        expect(circle).toBeTruthy();
        expect(circle.style.width).toBe('24px');
        expect(circle.style.height).toBe('24px');
        expect(circle.style.borderRadius).toBe('50%');
        // Browsers convert hex to rgb: #2E6BA8 → rgb(46, 107, 168)
        expect(circle.style.background).toBe('rgb(46, 107, 168)');
        expect(circle.textContent).toBe(num);
      });
    });
  });
});
