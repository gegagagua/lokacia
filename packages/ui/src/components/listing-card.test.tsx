// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ListingCard, PriceTag } from './listing-card';
import { businessTypeName, listings } from '../stories/fixtures';

afterEach(cleanup);
const [vipOwner, broker, noPhoto, offPlan] = listings as [typeof listings[0], typeof listings[0], typeof listings[0], typeof listings[0]];

describe('ListingCard', () => {
  it('shows VIP, deal type, business types, verified owner and confirmed label', () => {
    render(<ListingCard listing={{ ...vipOwner, lastConfirmedAt: new Date(Date.now() - 3 * 86_400_000).toISOString() }} href="/l/1" businessTypeName={businessTypeName} />);
    expect(screen.getByText('VIP')).toBeTruthy();
    expect(screen.getByText('იჯარა')).toBeTruthy();
    expect(screen.getByText('კაფე')).toBeTruthy();
    expect(screen.getByText('რესტორანი')).toBeTruthy();
    expect(screen.getByText('ვერიფ. მესაკუთრე')).toBeTruthy();
    expect(screen.getByText(/დადასტურდა 3 დღის წინ/)).toBeTruthy();
    expect(screen.getByRole('link', { name: vipOwner.title }).getAttribute('href')).toBe('/l/1');
  });

  it('shows broker commission and no VIP badge', () => {
    render(<ListingCard listing={broker} href="#" />);
    expect(screen.queryByText('VIP')).toBeNull();
    expect(screen.getByText('ბროკერი · 50%')).toBeTruthy();
    expect(screen.queryByText(/მესაკუთრე/)).toBeNull();
  });

  it('unverified owner without confirmation date and without photos', () => {
    const { container } = render(<ListingCard listing={noPhoto} href="#" />);
    expect(screen.getByText('მესაკუთრე')).toBeTruthy();
    expect(screen.queryByText(/დადასტურდა/)).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('იყიდება')).toBeTruthy();
  });

  it('off-plan badge and transfer deal type', () => {
    render(<ListingCard listing={offPlan} href="#" />);
    expect(screen.getByText('ბიზნესის გადაცემა')).toBeTruthy();
    expect(screen.getByText(/^მშენებლე/)).toBeTruthy();
  });

  it('favorite toggle is a labelled pressed button', () => {
    const onFavorite = vi.fn();
    const { rerender } = render(<ListingCard listing={broker} href="#" onFavorite={onFavorite} favorite={false} />);
    const btn = screen.getByRole('button', { name: 'ფავორიტებში დამატება' });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(btn);
    expect(onFavorite).toHaveBeenCalledOnce();
    rerender(<ListingCard listing={broker} href="#" onFavorite={onFavorite} favorite />);
    expect(screen.getByRole('button', { name: 'ფავორიტებიდან წაშლა' }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('PriceTag (formatters)', () => {
  it('formats monthly rent with thousands space, ₾ after amount and price per m²', () => {
    const { container } = render(<PriceTag priceMinor={450_000} period="month" areaM2={64} />);
    expect(container.textContent).toContain('4 500 ₾ / თვე');
    expect(container.textContent).toContain('70 ₾ / მ²');
  });
  it('formats sale price without period and USD with prefix sign', () => {
    expect(render(<PriceTag priceMinor={112_000_000} period="total" />).container.textContent).toBe('1 120 000 ₾');
    cleanup();
    expect(render(<PriceTag priceMinor={250_050} currency="USD" />).container.textContent).toBe('$2 500,50');
  });
});
