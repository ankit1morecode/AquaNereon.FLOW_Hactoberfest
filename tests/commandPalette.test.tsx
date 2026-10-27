/** @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { CommandPalette, searchCommands } from '../src/app/CommandPalette';

vi.mock('../src/services/ApiProvider', () => ({
  useQuery: () => ({ data: [{ node_id: 'AN-J-014', zone_id: 'Z-CENTRAL', location: { label: 'Exchange junction' } }] }),
}));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(cleanup);

function Location() { return <output data-testid="location">{useLocation().pathname}</output>; }
function setup() { render(<MemoryRouter><CommandPalette /><Location /></MemoryRouter>); }

describe('quick navigation', () => {
  it('matches every search term regardless of case', () => {
    const commands = [{ id: 'node', label: 'AN-J-014', detail: 'Exchange Z-CENTRAL', to: '/nodes/AN-J-014' }];
    expect(searchCommands(commands, 'exchange 014')).toEqual(commands);
    expect(searchCommands(commands, 'exchange missing')).toEqual([]);
  });
  it('opens with Ctrl+K, focuses search and navigates to a matching node with Enter', () => {
    setup();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const search = screen.getByRole('combobox');
    expect(document.activeElement).toBe(search);
    fireEvent.change(search, { target: { value: 'exchange' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(screen.getByTestId('location').textContent).toBe('/nodes/AN-J-014');
    expect(document.querySelector('dialog')?.open).toBe(false);
  });
  it('moves selection with arrows, ignores Enter on empty results and closes with focus restored', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Search/ }));
    const search = screen.getByRole('combobox');
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    expect(search.getAttribute('aria-activedescendant')).toBe('command-1');
    fireEvent.change(search, { target: { value: 'unknown node' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(screen.getByText('No matching pages or nodes.')).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe('/');
    fireEvent.click(screen.getByRole('button', { name: 'Close quick navigation' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Search/ }));
  });
  it('does not stack the palette over another dialog and still toggles its own modal', () => {
    render(<MemoryRouter><dialog open aria-label="Another modal"><button>Modal action</button></dialog><CommandPalette /></MemoryRouter>);
    const other = screen.getByRole('dialog', { name: 'Another modal' }) as HTMLDialogElement;
    const button = screen.getByRole('button', { name: 'Modal action' });
    button.focus();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(document.querySelector<HTMLDialogElement>('.command-dialog')?.open).toBe(false);
    expect(other.open).toBe(true);
    expect(document.activeElement).toBe(button);
    other.close();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(document.querySelector<HTMLDialogElement>('.command-dialog')?.open).toBe(true);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(document.querySelector<HTMLDialogElement>('.command-dialog')?.open).toBe(false);
  });
});
