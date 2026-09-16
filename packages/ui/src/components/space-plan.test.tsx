// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SpacePlan } from './space-plan';

afterEach(cleanup);

const texts = (c: HTMLElement) => [...c.querySelectorAll('text')].map((t) => t.textContent?.trim());

describe('SpacePlan', () => {
  it('draws width, depth, area, ceiling and power labels', () => {
    const { container } = render(<SpacePlan widthM={8} depthM={8.5} areaM2={68} ceilingM={3.4} powerKw={25} />);
    const t = texts(container);
    expect(t).toContain('8 მ');
    expect(t).toContain('8,5 მ');
    expect(t).toContain('68 მ²');
    expect(t).toContain('↕ ჭერი 3,4 მ');
    expect(t).toContain('⚡ 25 კვტ');
  });

  it('has an accessible Georgian label describing the drawing', () => {
    render(<SpacePlan widthM={20} depthM={31} areaM2={620} />);
    expect(screen.getByRole('img', { name: 'ნახაზი: 20 × 31 მ, 620 მ²' })).toBeTruthy();
  });

  it('derives plausible dimensions from area when width/depth are unknown', () => {
    const { container } = render(<SpacePlan areaM2={140} />);
    const dims = texts(container).filter((s) => s?.endsWith(' მ') && !s.includes('ჭერი'));
    expect(dims).toHaveLength(2);
    const [w, d] = dims.map((s) => Number(s!.replace(' მ', '').replace(',', '.')));
    expect(w! * d!).toBeGreaterThan(135);
    expect(w! * d!).toBeLessThan(145);
  });

  it('compact mode hides ceiling and power annotations', () => {
    const { container } = render(<SpacePlan compact widthM={8} depthM={8} areaM2={64} ceilingM={3.4} powerKw={25} />);
    const t = texts(container).join('|');
    expect(t).not.toContain('ჭერი');
    expect(t).not.toContain('კვტ');
    expect(t).toContain('64 მ²');
  });

  it('uses the custom title when given', () => {
    render(<SpacePlan areaM2={64} title="L-ფორმის ფართი" />);
    expect(screen.getByRole('img', { name: 'L-ფორმის ფართი' })).toBeTruthy();
  });
});
