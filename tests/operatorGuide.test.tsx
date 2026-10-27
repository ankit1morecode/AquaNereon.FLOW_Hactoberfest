/** @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { OperatorGuide } from '../src/app/OperatorGuide';
import { searchGuide } from '../src/services/operatorGuide';
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(cleanup);
function Location() { return <output data-testid="guide-location">{useLocation().pathname}</output>; }
function setup() { render(<MemoryRouter><OperatorGuide /><input aria-label="Operator note" /><Location /></MemoryRouter>); }

describe('searchable operator guide', () => {
  it('matches all search terms and explains data scope for telemetry and reports', () => {
    expect(searchGuide('15 FROZEN').map((topic) => topic.id)).toEqual(['telemetry']);
    expect(searchGuide('previous calendar')[0].body).toContain('loaded events');
    expect(searchGuide('no-such-guide-term')).toEqual([]);
  });
  it('opens with ? outside editors, focuses search, and navigates to a relevant page', () => {
    setup();
    fireEvent.keyDown(window, { key: '?' });
    const search = screen.getByRole('searchbox', { name: 'Search operator guide' });
    expect(document.activeElement).toBe(search);
    fireEvent.change(search, { target: { value: 'structural topology' } });
    fireEvent.click(screen.getByRole('link', { name: 'Open network inventory →' }));
    expect(screen.getByTestId('guide-location').textContent).toBe('/network');
    expect(document.querySelector('dialog')?.open).toBe(false);
  });
  it('leaves text entry and other open dialogs in control of their keyboard context', () => {
    setup();
    fireEvent.keyDown(screen.getByLabelText('Operator note'), { key: '?' });
    expect(document.querySelector('dialog')?.open).toBe(false);
    const other = document.createElement('dialog');
    document.body.appendChild(other);
    other.showModal();
    fireEvent.keyDown(window, { key: '?' });
    expect(document.querySelector('.guide-dialog')?.hasAttribute('open')).toBe(false);
    other.remove();
    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search operator guide' }), { target: { value: 'no-such-guide-term' } });
    expect(screen.getByText('No guide topics match this search.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close operator guide' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Help' }));
  });
});
