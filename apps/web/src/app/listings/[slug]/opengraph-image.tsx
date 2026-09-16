import { ImageResponse } from 'next/og';
import { DEAL_TYPE_LABELS_KA, formatMoney } from '@lokacia/contracts';
import { getListingPublic } from '@/components/portal/data';
import { C, OG_SIZE, OgLogo, OgPlan, ogFonts } from '@/components/portal/og/og-drawing';

export const alt = 'ფართის ნახაზი, ფასი და ფართობი — lokacia.ge';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const revalidate = 3600;

const PERIOD: Record<string, string> = { month: ' / თვე', day: ' / დღე', hour: ' / სთ', total: '' };

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [l, fonts] = await Promise.all([getListingPublic(slug).catch(() => null), ogFonts()]);
  const title = l ? (l.title.length > 80 ? `${l.title.slice(0, 78)}…` : l.title) : 'ფართი ვერ მოიძებნა';
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: C.plaster, fontFamily: 'Noto Sans Georgian', color: C.basalt }}>
        <div style={{ width: 16, height: '100%', background: C.green, display: 'flex' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '48px 48px 44px 56px' }}>
          <OgLogo />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {l && (
              <div style={{ display: 'flex', gap: 10, fontSize: 22 }}>
                <div style={{ display: 'flex', border: `2px solid ${C.green}`, color: C.green, padding: '4px 14px', borderRadius: 6 }}>{DEAL_TYPE_LABELS_KA[l.dealType]}</div>
                {l.districtName && <div style={{ display: 'flex', border: `2px solid ${C.stone}`, color: C.basalt, padding: '4px 14px', borderRadius: 6 }}>{l.districtName}</div>}
              </div>
            )}
            <div style={{ display: 'flex', fontSize: 38, fontWeight: 700, lineHeight: 1.25, maxHeight: 144, overflow: 'hidden' }}>{title}</div>
          </div>
          {l ? (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 36, borderTop: `2px solid ${C.basalt}`, paddingTop: 22 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', fontSize: 20, color: C.stone }}>ფასი</div>
                <div style={{ display: 'flex', fontSize: 50, fontWeight: 700 }}>{`${formatMoney(l.priceMinor, l.currency)}${PERIOD[l.pricePeriod] ?? ''}`}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', fontSize: 20, color: C.stone }}>ფართი</div>
                <div style={{ display: 'flex', fontSize: 50, fontWeight: 700 }}>{`${l.areaM2} მ²`}</div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', fontSize: 30, color: C.stone }}>კომერციული ფართები ბიზნესის თვალით</div>
          )}
        </div>
        <div style={{ width: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: `2px solid #CDD4CC`, background: C.plaster }}>
          <OgPlan areaM2={l?.areaM2 ?? 64} widthM={l?.passport.widthM} depthM={l?.passport.depthM} />
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
