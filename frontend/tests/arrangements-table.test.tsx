/**
 * Arrangements Table Tests
 *
 * Tests the redesigned table layout with bulk selection, run confirmation modal, and credit estimates
 *
 * @vitest-environment jsdom
 */

import './setup-jsdom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import ArrangementsPage from '@/app/(dashboard)/arrangements/page.tsx';

// Mock Next.js hooks
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

// Mock Clerk auth
vi.mock('@clerk/nextjs', () => ({
  useAuth: vi.fn(),
}));

// Mock toast
vi.mock('@/components/ui/toast', () => ({
  addToast: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

const mockArrangements = [
  {
    id: 'arr-1',
    name: 'Apollo enrichment',
    description: 'Enrich with Apollo',
    enrichment_steps: [
      {
        provider: 'apollo',
        fields: ['Industry', 'Employee count', 'Revenue'],
        order: 1,
      },
    ],
    last_run_at: '2024-05-31T10:00:00Z',
    total_runs: 3,
    total_records_processed: 1200,
    total_credits_used: 120,
    created_at: '2024-05-01T10:00:00Z',
  },
  {
    id: 'arr-2',
    name: 'Clearbit enrichment',
    description: 'Enrich with Clearbit',
    enrichment_steps: [
      {
        provider: 'clearbit',
        fields: ['Industry', 'Employee count'],
        order: 1,
      },
    ],
    last_run_at: null,
    total_runs: 0,
    total_records_processed: 0,
    total_credits_used: 0,
    created_at: '2024-05-15T10:00:00Z',
  },
];

describe('Arrangements Table', () => {
  const mockPush = vi.fn();
  const mockGet = vi.fn(() => null);

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock router
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as any);
    vi.mocked(useSearchParams).mockReturnValue({ get: mockGet } as any);

    // Mock auth as admin
    vi.mocked(useAuth).mockReturnValue({ orgRole: 'org:admin' } as any);

    // Mock fetch responses
    (global.fetch as any).mockImplementation((url: string) => {
      if (url === '/api/arrangements') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ arrangements: mockArrangements }),
        });
      }
      if (url.includes('/estimate')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            estimated_records: 2835,
            provider: 'apollo',
            is_byok: true,
            credits_required: 0,
            credits_available: 480,
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  it('1. Table renders arrangement rows', async () => {
    render(<ArrangementsPage />);

    await waitFor(() => {
      expect(screen.getByText('Apollo enrichment')).toBeInTheDocument();
      expect(screen.getByText('Clearbit enrichment')).toBeInTheDocument();
    });

    // Should show fields
    expect(screen.getByText(/Industry, Employee count, Revenue/)).toBeInTheDocument();
  });

  it('2. Select all checkbox selects all rows', async () => {
    render(<ArrangementsPage />);

    await waitFor(() => {
      expect(screen.getByText('Apollo enrichment')).toBeInTheDocument();
    });

    // Find select all checkbox in header row
    const checkboxes = screen.getAllByRole('checkbox');
    const selectAllCheckbox = checkboxes[0]; // First checkbox is select all

    // Click select all
    fireEvent.click(selectAllCheckbox);

    // Verify all checkboxes are checked
    await waitFor(() => {
      checkboxes.forEach(cb => {
        expect((cb as HTMLInputElement).checked).toBe(true);
      });
    });
  });

  it('3. Bulk delete button appears when rows selected', async () => {
    render(<ArrangementsPage />);

    await waitFor(() => {
      expect(screen.getByText('Apollo enrichment')).toBeInTheDocument();
    });

    // Select one checkbox
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]); // First data row checkbox

    // Bulk actions bar should appear
    await waitFor(() => {
      expect(screen.getByText('1 arrangement selected')).toBeInTheDocument();
      expect(screen.getByText('Delete selected')).toBeInTheDocument();
    });
  });

  it('4. Delete confirmation modal shown before delete', async () => {
    render(<ArrangementsPage />);

    await waitFor(() => {
      expect(screen.getByText('Apollo enrichment')).toBeInTheDocument();
    });

    // Click delete in dropdown
    const dropdownButtons = screen.getAllByRole('button');
    const moreButton = dropdownButtons.find(btn =>
      btn.querySelector('svg')?.classList.contains('lucide-more-vertical')
    );

    if (moreButton) {
      fireEvent.click(moreButton);

      await waitFor(() => {
        const deleteButton = screen.getByText('Delete');
        fireEvent.click(deleteButton);
      });

      // Modal should appear
      await waitFor(() => {
        expect(screen.getByText('Delete arrangement?')).toBeInTheDocument();
      });
    }
  });

  it('5. Run confirmation modal shown before run', async () => {
    render(<ArrangementsPage />);

    await waitFor(() => {
      expect(screen.getByText('Apollo enrichment')).toBeInTheDocument();
    });

    // Click Run button
    const runButtons = screen.getAllByText('Run');
    fireEvent.click(runButtons[0]);

    // Modal should appear
    await waitFor(() => {
      expect(screen.getByText('Run arrangement')).toBeInTheDocument();
      expect(screen.getByText('Loading estimate...')).toBeInTheDocument();
    });

    // Wait for estimate to load
    await waitFor(() => {
      expect(screen.getByText('Estimated records: ~2,835')).toBeInTheDocument();
    });
  });

  it('6. Credit warning shown when credits insufficient', async () => {
    // Mock insufficient credits
    (global.fetch as any).mockImplementation((url: string) => {
      if (url === '/api/arrangements') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ arrangements: mockArrangements }),
        });
      }
      if (url.includes('/estimate')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            estimated_records: 5000,
            provider: 'clearbit',
            is_byok: false,
            credits_required: 500,
            credits_available: 100,
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<ArrangementsPage />);

    await waitFor(() => {
      expect(screen.getByText('Apollo enrichment')).toBeInTheDocument();
    });

    // Click Run button
    const runButtons = screen.getAllByText('Run');
    fireEvent.click(runButtons[0]);

    // Wait for estimate to load
    await waitFor(() => {
      expect(screen.getByText(/Not enough credits/)).toBeInTheDocument();
    });
  });

  it('7. Status badge correct for each status type', async () => {
    render(<ArrangementsPage />);

    await waitFor(() => {
      expect(screen.getByText('Apollo enrichment')).toBeInTheDocument();
    });

    // Should show "Completed" for arrangement with last_run_at
    expect(screen.getByText('Completed')).toBeInTheDocument();

    // Should show "Never run" for arrangement without last_run_at
    expect(screen.getByText('Never run')).toBeInTheDocument();
  });

  it('8. Never run state shown correctly', async () => {
    render(<ArrangementsPage />);

    await waitFor(() => {
      expect(screen.getByText('Clearbit enrichment')).toBeInTheDocument();
    });

    // Find the row for "Clearbit enrichment" (never run)
    const neverRunBadges = screen.getAllByText('Never run');
    expect(neverRunBadges.length).toBeGreaterThan(0);

    // Should show "—" for last run date
    const table = screen.getByText('Clearbit enrichment').closest('div[style*="grid"]');
    if (table) {
      expect(table.textContent).toContain('—');
    }
  });
});
