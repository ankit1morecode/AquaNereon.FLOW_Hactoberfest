/** @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { createOperatorPreferences, DEFAULT_OPERATOR_PREFERENCES, OPERATOR_PREFERENCES_KEY, useApplyOperatorPreferences } from '../src/services/operatorPreferences';
import { DisplayPreferences } from '../src/app/DisplayPreferences';
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(cleanup);
function memory() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}

describe('operator display preferences', () => {
  it('validates saved preferences and restores valid choices in another session', () => {
    const storage = memory();
    storage.setItem(OPERATOR_PREFERENCES_KEY, '{invalid');
    expect(createOperatorPreferences(() => storage).getSnapshot().persisted).toBe(false);
    const store = createOperatorPreferences(() => storage);
    store.update({ density: 'compact', motion: 'reduced', highContrast: true });
    expect(createOperatorPreferences(() => storage).getSnapshot().preferences).toEqual({ density: 'compact', motion: 'reduced', highContrast: true });
    storage.setItem(OPERATOR_PREFERENCES_KEY, JSON.stringify({ version: 1, density: 'invalid', motion: 'invalid', highContrast: 'true' }));
    expect(createOperatorPreferences(() => storage).getSnapshot().preferences).toEqual(DEFAULT_OPERATOR_PREFERENCES);
  });
  it('keeps choices and notifies subscribers when storage is denied', () => {
    const store = createOperatorPreferences(() => { throw new Error('Denied'); });
    let updates = 0;
    const unsubscribe = store.subscribe(() => { updates++; });
    store.update({ density: 'compact' });
    expect(store.getSnapshot().preferences.density).toBe('compact');
    expect(store.getSnapshot().persisted).toBe(false);
    expect(updates).toBe(1);
    unsubscribe();
  });
  it('applies preferences to the whole app and restores attributes on unmount', () => {
    const storage = memory();
    const store = createOperatorPreferences(() => storage);
    function Apply() { useApplyOperatorPreferences(store); return null; }
    const view = render(<Apply />);
    act(() => store.update({ density: 'compact', motion: 'reduced', highContrast: true }));
    expect(document.documentElement.dataset.uiDensity).toBe('compact');
    expect(document.documentElement.dataset.uiMotion).toBe('reduced');
    expect(document.documentElement.dataset.uiContrast).toBe('high');
    view.unmount();
    expect(document.documentElement.dataset.uiDensity).toBeUndefined();
  });
  it('updates and resets preferences from the dialog without changing asset data', () => {
    const storage = memory();
    const store = createOperatorPreferences(() => storage);
    render(<MemoryRouter><DisplayPreferences store={store} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Display' }));
    fireEvent.change(screen.getByLabelText('Layout density'), { target: { value: 'compact' } });
    fireEvent.click(screen.getByLabelText('Higher text contrast'));
    expect(store.getSnapshot().preferences).toMatchObject({ density: 'compact', highContrast: true });
    fireEvent.click(screen.getByRole('button', { name: 'Reset display preferences' }));
    expect(store.getSnapshot().preferences).toEqual(DEFAULT_OPERATOR_PREFERENCES);
    fireEvent.click(screen.getByRole('button', { name: 'Close display preferences' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Display' }));
  });
});
