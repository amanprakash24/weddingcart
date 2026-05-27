import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const runtime = 'edge';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #0C0408 0%, #1C0A12 50%, #2D0B1F 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Gold corner accent top-left */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '200px',
            height: '200px',
            background: 'radial-gradient(circle at top left, rgba(197,164,109,0.18) 0%, transparent 70%)',
          }}
        />
        {/* Gold corner accent bottom-right */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: '300px',
            height: '300px',
            background: 'radial-gradient(circle at bottom right, rgba(139,26,74,0.25) 0%, transparent 70%)',
          }}
        />

        {/* Top border line */}
        <div
          style={{
            position: 'absolute',
            top: '0',
            left: '0',
            right: '0',
            height: '4px',
            background: 'linear-gradient(to right, transparent, #C5A46D, #8B1A4A, #C5A46D, transparent)',
          }}
        />

        {/* Heart + Logo name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              background: '#8B1A4A',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
            }}
          >
            ♥
          </div>
          <div
            style={{
              fontSize: '64px',
              fontWeight: '700',
              color: '#FFFFFF',
              letterSpacing: '-1px',
              fontFamily: 'Georgia, serif',
            }}
          >
            ShaadiShopping
          </div>
        </div>

        {/* Gold divider */}
        <div
          style={{
            width: '120px',
            height: '2px',
            background: 'linear-gradient(to right, transparent, #C5A46D, transparent)',
            marginBottom: '28px',
          }}
        />

        {/* Tagline */}
        <div
          style={{
            fontSize: '28px',
            color: '#C5A46D',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            fontFamily: 'Georgia, serif',
            marginBottom: '20px',
          }}
        >
          India&apos;s Expert Wedding Platform
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: '20px',
            color: 'rgba(255,255,255,0.55)',
            fontFamily: 'sans-serif',
            textAlign: 'center',
            maxWidth: '680px',
            lineHeight: '1.5',
            marginBottom: '36px',
          }}
        >
          Venues · Makeup · Catering · Photographers · Decorators · Mehndi
        </div>

        {/* CTA pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(197,164,109,0.12)',
            border: '1.5px solid rgba(197,164,109,0.35)',
            borderRadius: '999px',
            padding: '12px 32px',
          }}
        >
          <div style={{ fontSize: '16px', color: '#C5A46D', fontFamily: 'sans-serif', letterSpacing: '2px', textTransform: 'uppercase' }}>
            www.shaadishopping.com
          </div>
        </div>

        {/* Bottom border line */}
        <div
          style={{
            position: 'absolute',
            bottom: '0',
            left: '0',
            right: '0',
            height: '4px',
            background: 'linear-gradient(to right, transparent, #8B1A4A, #C5A46D, #8B1A4A, transparent)',
          }}
        />
      </div>
    ),
    { ...size }
  );
}
