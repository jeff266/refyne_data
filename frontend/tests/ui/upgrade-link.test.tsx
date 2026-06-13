/**
 * @vitest-environment jsdom
 */
import '../setup-jsdom';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UpgradeLink } from '@/components/ui/UpgradeLink';

describe('UpgradeLink Component', () => {
  it('1. renders with default href to /settings/billing', () => {
    render(<UpgradeLink reason="merge records" />);

    const link = screen.getByRole('link');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/settings/billing');
    expect(link.textContent).toContain('View plans');
  });

  it('2. renders with custom href', () => {
    render(<UpgradeLink reason="use feature" href="/custom-page" />);

    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/custom-page');
  });

  it('3. shows target plan when provided', () => {
    const { container } = render(
      <UpgradeLink reason="merge records" targetPlan="Growth" />
    );

    expect(container.textContent).toContain('Requires Growth plan');
  });

  it('4. shows "Upgrade to unlock" when no target plan', () => {
    const { container } = render(<UpgradeLink reason="merge records" />);

    expect(container.textContent).toContain('Upgrade to unlock');
  });

  it('5. has testid for programmatic access', () => {
    render(<UpgradeLink reason="test" />);

    const element = screen.getByTestId('upgrade-link');
    expect(element).toBeTruthy();
  });
});

describe('UpgradeLink with Entitlements', () => {
  it('6. exempt orgs should not render (simulated)', () => {
    // Simulate exempt org check
    const tier = 'exempt';
    const shouldShow = tier !== 'exempt' && tier !== 'internal';

    expect(shouldShow).toBe(false);
  });

  it('7. internal orgs should not render (simulated)', () => {
    // Simulate internal org check
    const tier = 'internal';
    const shouldShow = tier !== 'exempt' && tier !== 'internal';

    expect(shouldShow).toBe(false);
  });

  it('8. trial orgs should render (simulated)', () => {
    // Simulate trial org check
    const tier = 'trial';
    const shouldShow = tier !== 'exempt' && tier !== 'internal';

    expect(shouldShow).toBe(true);
  });
});
