/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readEventFilters } from '../src/services/eventFilters';
import { EVENT_VIEWS_KEY, persistSavedEventViews, readEventViews, writeEventViews } from '../src/services/eventViews';
import { SavedEventViews } from '../src/pages/Events/SavedEventViews';

beforeEach(() => { localStorage.clear(); persistSavedEventViews([]); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('saved event filter views', () => {
  it('saves, reloads, applies and deletes an operator view', () => {
    const filters = readEventFilters(new URLSearchParams('severity=HIGH&zone=Z-CENTRAL&sort=newest'));
    const onApply = vi.fn();
    const { unmount } = render(<SavedEventViews filters={filters} onApply={onApply} />);
    fireEvent.change(screen.getByLabelText('New event view name'), { target: { value: 'Central urgent' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save view' }));
    const saved = readEventViews(localStorage).views;
    expect(saved[0]).toMatchObject({ name: 'Central urgent', filters });
    unmount();
    render(<SavedEventViews filters={readEventFilters(new URLSearchParams())} onApply={onApply} />);
    fireEvent.change(screen.getByLabelText('Load saved event view'), { target: { value: saved[0].id } });
    expect(onApply).toHaveBeenCalledWith(filters);
    cleanup();
    render(<SavedEventViews filters={filters} onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete view' }));
    expect(readEventViews(localStorage).views).toEqual([]);
  });

  it('updates the same view name instead of creating duplicates', () => {
    const filters = readEventFilters(new URLSearchParams('severity=HIGH'));
    const { rerender } = render(<SavedEventViews filters={filters} onApply={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('New event view name'), { target: { value: 'Urgent' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save view' }));
    rerender(<SavedEventViews filters={{ ...filters, zone: 'Z-NORTH' }} onApply={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('New event view name'), { target: { value: 'urgent' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save view' }));
    expect(readEventViews(localStorage).views).toHaveLength(1);
    expect(readEventViews(localStorage).views[0].filters.zone).toBe('Z-NORTH');
  });

  it('rejects corrupt data and ignores malformed or duplicate entries', () => {
    localStorage.setItem(EVENT_VIEWS_KEY, '{invalid');
    expect(readEventViews(localStorage)).toMatchObject({ views: [], error: expect.any(String) });
    const valid = { id: 'one', name: 'Valid', filters: readEventFilters(new URLSearchParams()) };
    localStorage.setItem(EVENT_VIEWS_KEY, JSON.stringify({ version: 1, views: [null, valid, valid, { id: 'bad', name: 'Bad', filters: { q: 12 } }] }));
    expect(readEventViews(localStorage).views).toEqual([valid]);
  });

  it('can delete a chosen view even when multiple views have the same filters', () => {
    const filters = readEventFilters(new URLSearchParams());
    writeEventViews(localStorage, [{ id: 'one', name: 'First', filters }, { id: 'two', name: 'Second', filters }]);
    render(<SavedEventViews filters={filters} onApply={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Load saved event view'), { target: { value: 'two' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete view' }));
    expect(readEventViews(localStorage).views.map((view) => view.name)).toEqual(['First']);
  });

  it('keeps session functionality when browser storage fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
    const filters = readEventFilters(new URLSearchParams());
    const { unmount } = render(<SavedEventViews filters={filters} onApply={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('New event view name'), { target: { value: 'Session view' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save view' }));
    expect(screen.getByRole('status').textContent).toContain('changes last for this session');
    expect(screen.getByRole('option', { name: 'Session view' })).toBeDefined();
    unmount();
    render(<SavedEventViews filters={filters} onApply={vi.fn()} />);
    expect(screen.getByRole('option', { name: 'Session view' })).toBeDefined();
    expect(screen.getByRole('status').textContent).toContain('last for this session');
    expect(writeEventViews(localStorage, [])).toBe(false);
    expect(readEventViews({ getItem: () => { throw new Error('Denied'); } }).error).toBeTruthy();
  });

  it('retains saved views and deletions across remounts when the localStorage accessor is blocked', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('Access denied'); });
    const filters = readEventFilters(new URLSearchParams('severity=HIGH'));
    const onApply = vi.fn();
    const { unmount } = render(<SavedEventViews filters={filters} onApply={onApply} />);
    fireEvent.change(screen.getByLabelText('New event view name'), { target: { value: 'Blocked storage view' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save view' }));
    unmount();
    const second = render(<SavedEventViews filters={readEventFilters(new URLSearchParams())} onApply={onApply} />);
    const option = screen.getByRole('option', { name: 'Blocked storage view' }) as HTMLOptionElement;
    fireEvent.change(screen.getByLabelText('Load saved event view'), { target: { value: option.value } });
    expect(onApply).toHaveBeenCalledWith(filters);
    second.rerender(<SavedEventViews filters={filters} onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete view' }));
    second.unmount();
    render(<SavedEventViews filters={filters} onApply={onApply} />);
    expect(screen.queryByRole('option', { name: 'Blocked storage view' })).toBeNull();
  });
});
