import { ImageResponse } from 'next/og';
import { C, OG_SIZE, OgLogo, OgPlan, ogFonts } from '@/components/portal/og/og-drawing';

export const alt = 'lokacia.ge — კომერციული ფართები ბიზნესის თვალით';
export const size = OG_SIZE;
export const contentType = 'image/png';

/** Default site OG image: brand drawing + tagline. */
export default async function Image() {
  const fonts = await ogFonts();
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: C.plaster, fontFamily: 'Noto Sans Georgian', color: C.basalt }}>
        <div style={{ width: 16, height: '100%', background: C.green, display: 'flex' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '56px 48px 56px 56px' }}>
          <OgLogo />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', fontSize: 50, fontWeight: 700, lineHeight: 1.2 }}>კომერციული ფართები ბიზნესის თვალით</div>
            <div style={{ display: 'flex', fontSize: 24, color: C.stone, lineHeight: 1.4 }}>ტექნიკური პასპორტი, ლოკაციის ანალიტიკა და დადასტურებული განცხადებები</div>
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 22 }}>
            {['ოფისი', 'მაღაზია', 'კაფე', 'საწყობი'].map((x) => (
              <div key={x} style={{ display: 'flex', border: `2px solid ${C.green}`, color: C.green, padding: '4px 14px', borderRadius: 6 }}>
                {x}
              </div>
            ))}
          </div>
        </div>
        <div style={{ width: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '2px solid #CDD4CC' }}>
          <OgPlan areaM2={64} widthM={8} depthM={8} box={{ w: 420, h: 420 }} />
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
