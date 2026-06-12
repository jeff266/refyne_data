/**
 * @vitest-environment jsdom
 */
import '../setup-jsdom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FieldSearchCombobox, HubSpotProperty } from '@/components/ui/FieldSearchCombobox';

const mockProperties: HubSpotProperty[] = [
  { name: 'lifecyclestage', label: 'Lifecycle Stage', type: 'enumeration' },
  { name: 'industry', label: 'Industry', type: 'enumeration' },
  { name: 'name', label: 'Company Name', type: 'string' },
  { name: 'domain', label: 'Website Domain', type: 'string' },
  { name: 'numberofemployees', label: 'Number of Employees', type: 'number' },
];

describe('FieldSearchCombobox', () => {
  it('filters fields by label (case insensitive)', async () => {
    const onChange = vi.fn();
    render(
      <FieldSearchCombobox
        properties={mockProperties}
        value=""
        onChange={onChange}
      />
    );

    const input = screen.getByPlaceholderText('Search fields...');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'lifecycle' } });

    await waitFor(() => {
      expect(screen.getByText('Lifecycle Stage')).toBeInTheDocument();
      expect(screen.queryByText('Industry')).not.toBeInTheDocument();
    });
  });

  it('filters fields by key', async () => {
    const onChange = vi.fn();
    render(
      <FieldSearchCombobox
        properties={mockProperties}
        value=""
        onChange={onChange}
      />
    );

    const input = screen.getByPlaceholderText('Search fields...');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'numberofemployees' } });

    await waitFor(() => {
      expect(screen.getByText('Number of Employees')).toBeInTheDocument();
      expect(screen.queryByText('Lifecycle Stage')).not.toBeInTheDocument();
    });
  });

  it('selects field on click', async () => {
    const onChange = vi.fn();
    render(
      <FieldSearchCombobox
        properties={mockProperties}
        value=""
        onChange={onChange}
      />
    );

    const input = screen.getByPlaceholderText('Search fields...');
    fireEvent.focus(input);

    await waitFor(() => {
      expect(screen.getByText('Lifecycle Stage')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Lifecycle Stage'));

    expect(onChange).toHaveBeenCalledWith('lifecyclestage');
  });

  it('closes on Escape', async () => {
    const onChange = vi.fn();
    render(
      <FieldSearchCombobox
        properties={mockProperties}
        value=""
        onChange={onChange}
      />
    );

    const input = screen.getByPlaceholderText('Search fields...');
    fireEvent.focus(input);

    await waitFor(() => {
      expect(screen.getByText('Lifecycle Stage')).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByText('Lifecycle Stage')).not.toBeInTheDocument();
    });
  });

  it('closes on outside click', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <div>
        <FieldSearchCombobox
          properties={mockProperties}
          value=""
          onChange={onChange}
        />
        <div data-testid="outside">Outside</div>
      </div>
    );

    const input = screen.getByPlaceholderText('Search fields...');
    fireEvent.focus(input);

    await waitFor(() => {
      expect(screen.getByText('Lifecycle Stage')).toBeInTheDocument();
    });

    fireEvent.mouseDown(screen.getByTestId('outside'));

    await waitFor(() => {
      expect(screen.queryByText('Lifecycle Stage')).not.toBeInTheDocument();
    });
  });

  it('shows empty state when no match', async () => {
    const onChange = vi.fn();
    render(
      <FieldSearchCombobox
        properties={mockProperties}
        value=""
        onChange={onChange}
      />
    );

    const input = screen.getByPlaceholderText('Search fields...');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'nonexistent' } });

    await waitFor(() => {
      expect(screen.getByText(/No fields match "nonexistent"/)).toBeInTheDocument();
    });
  });

  it('portal renders into document.body', async () => {
    const onChange = vi.fn();
    render(
      <FieldSearchCombobox
        properties={mockProperties}
        value=""
        onChange={onChange}
      />
    );

    const input = screen.getByPlaceholderText('Search fields...');
    fireEvent.focus(input);

    await waitFor(() => {
      // Dropdown should be portal-rendered into document.body
      const lifecycleStageOption = screen.getByText('Lifecycle Stage');
      const dropdownContainer = lifecycleStageOption.closest('[style*="position: fixed"]');
      expect(dropdownContainer?.parentElement).toBe(document.body);
    });
  });

  it('displays selected field label when value is set', () => {
    const onChange = vi.fn();
    render(
      <FieldSearchCombobox
        properties={mockProperties}
        value="lifecyclestage"
        onChange={onChange}
      />
    );

    const input = screen.getByDisplayValue('Lifecycle Stage');
    expect(input).toBeInTheDocument();
  });

  it('is disabled when disabled prop is true', () => {
    const onChange = vi.fn();
    render(
      <FieldSearchCombobox
        properties={mockProperties}
        value=""
        onChange={onChange}
        disabled={true}
      />
    );

    const input = screen.getByPlaceholderText('Search fields...');
    expect(input).toBeDisabled();
  });
});
