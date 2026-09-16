// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Kanban, type KanbanItem } from './kanban';

afterEach(cleanup);

type Deal = KanbanItem & { title: string };
const columns = [
  { key: 'new', title: 'ახალი მოთხოვნა' },
  { key: 'viewing', title: 'ჩვენება' },
];
const items: Deal[] = [
  { id: 'd1', column: 'new', title: 'ყავის სახლი' },
  { id: 'd2', column: 'viewing', title: 'ოფის ჰაბ' },
];

/** jsdom has no layout: give each card/column a rect based on its column so dnd-kit collision detection works. */
function mockLayout() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const section = this.closest('section');
    const colIndex = section ? [...document.querySelectorAll('section')].indexOf(section) : 0;
    const left = colIndex * 300;
    const isCard = this.getAttribute('aria-roledescription') === 'sortable';
    const r = isCard ? { left, top: 60, width: 280, height: 60 } : { left, top: 40, width: 280, height: 400 };
    return { ...r, x: r.left, y: r.top, right: r.left + r.width, bottom: r.top + r.height, toJSON: () => r } as DOMRect;
  });
}

describe('Kanban', () => {
  it('renders columns as labelled regions with focusable sortable cards', () => {
    render(<Kanban columns={columns} items={items} onMove={() => undefined} renderItem={(d) => <span>{d.title}</span>} />);
    expect(screen.getByRole('region', { name: 'ახალი მოთხოვნა' })).toBeTruthy();
    const card = screen.getByText('ყავის სახლი').closest('[aria-roledescription="sortable"]') as HTMLElement;
    expect(card.getAttribute('role')).toBe('button');
    expect(card.tabIndex).toBe(0);
    expect(document.body.textContent).toContain('ბარათის ასაღებად დააჭირეთ Space ან Enter');
  });

  it('moves a card to the next column with the keyboard (Space, ArrowRight, Space)', async () => {
    mockLayout();
    const onMove = vi.fn();
    render(<Kanban columns={columns} items={items} onMove={onMove} renderItem={(d) => <span>{d.title}</span>} />);
    const card = screen.getByText('ყავის სახლი').closest('[aria-roledescription="sortable"]') as HTMLElement;
    card.focus();
    await act(async () => {
      fireEvent.keyDown(card, { code: 'Space', key: ' ' });
      // KeyboardSensor attaches its document listeners on the next tick
      await new Promise((r) => setTimeout(r, 0));
    });
    await act(async () => {
      fireEvent.keyDown(document, { code: 'ArrowRight', key: 'ArrowRight' });
    });
    await act(async () => {
      fireEvent.keyDown(document, { code: 'Space', key: ' ' });
    });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0]![0]).toBe('d1');
    expect(onMove.mock.calls[0]![1]).toBe('viewing');
    vi.restoreAllMocks();
  });
});
