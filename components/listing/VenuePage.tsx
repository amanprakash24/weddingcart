import Image from 'next/image';
import Link from 'next/link';
import type { Vendor } from '@/types';
import type { VenueView } from '@/lib/listing/venueView';
import { SHAADI_PHONE, shaadiWhatsAppLink } from '@/lib/shaadiContact';
import { ONLINE_RATING_LABEL, VERIFIED_REVIEWS_LABEL, type PublicReview } from '@/lib/reviews/reviewView';
import VenueEnquiryCard from './VenueEnquiryCard';
import VenueGallery from './VenueGallery';
import VenuePackageButton from './VenuePackageButton';
import s from './venue.module.css';

// THE master venue page (founder-approved design, 19 Nov 2026): every venue uses exactly this, filled from its own
// listing (lib/listing/venueView.ts). Sections with nothing to show are left out; nothing is invented.
// Couples contact Shaadi Shopping (call, WhatsApp, enquiry), never the venue directly.
export interface VerifiedReviews { summary: { average: number; count: number } | null; reviews: PublicReview[] }

const Pin = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A6A2F" strokeWidth="1.8" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
);
const Star = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="#C9A86A" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /></svg>
);
const PhoneIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>
);
const Tick = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8A6A2F" strokeWidth="2" aria-hidden="true" style={{ flexShrink: 0 }}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

function Arch({ src, alt, className, priority }: { src?: string; alt: string; className: string; priority?: boolean }) {
  return (
    <div className={`${s.arch} ${className}`}>
      {src ? <Image src={src} alt={alt} fill priority={priority} sizes="(max-width: 760px) 60vw, 360px" className="object-cover" /> : <div className={s.noPhoto}>Photos coming soon</div>}
    </div>
  );
}

export default function VenuePage({ view: v, vendor, verified }: { view: VenueView; vendor: Vendor; verified: VerifiedReviews | null }) {
  const whatsapp = shaadiWhatsAppLink(`Hi, I am interested in ${v.name} for my wedding. Please help me with the date and price.`);
  // Side arches only for real extra photos: one photo is never repeated to fill the stack.
  const [p1, p2, p3] = v.photos;
  const pkgById = new Map(vendor.packages.map((p) => [p.id, p]));

  return (
    <div className={s.page}>

      <section aria-labelledby="venue-name" className={s.hero}>
        <div className={s.wrap}>
          <nav aria-label="Breadcrumb" className={s.crumbs}>
            <Link href="/">Home</Link><span aria-hidden="true">›</span>
            <Link href="/cities/patna/venue">Venues in Patna</Link><span aria-hidden="true">›</span>
            <span style={{ color: '#221714', fontWeight: 600 }}>{v.name}</span>
          </nav>
          <div className={s.heroGrid}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <p className={s.kicker}>{v.kind}</p>
              <h1 id="venue-name" className={s.h1}>{v.name}</h1>
              <div className={s.meta}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Pin />{v.place}</span>
                {verified?.summary ? (
                  <span className={s.pill} title={VERIFIED_REVIEWS_LABEL}><Star /><b style={{ color: '#221714' }}>{verified.summary.average}</b> · {verified.summary.count} couple {verified.summary.count === 1 ? 'review' : 'reviews'}</span>
                ) : v.onlineRating ? (
                  <span className={s.pill} title={ONLINE_RATING_LABEL}><Star /><b style={{ color: '#221714' }}>{v.onlineRating.value}</b> · {v.onlineRating.count} online {v.onlineRating.count === 1 ? 'review' : 'reviews'}</span>
                ) : null}
              </div>
              <div className={s.facts} style={{ marginTop: 6 }}>
                {v.facts.map((f) => (
                  <div key={f.label} className={s.fact}><span>{f.label}</span><span>{f.value}</span></div>
                ))}
              </div>
              <div className={s.ctas}>
                <a href="#enquire" className={s.btnPrimary}>Check date and price</a>
                <a href={`tel:${SHAADI_PHONE}`} className={s.btnLine}><PhoneIcon />Talk to a Wedding Expert</a>
              </div>
            </div>
            <div className={s.stack} aria-label={`Photos of ${v.name}`} role="img">
              {p3 && <Arch src={p3} alt="" className={s.a3} />}
              {p2 && <Arch src={p2} alt="" className={s.a2} />}
              <Arch src={p1} alt={`${v.name}`} className={s.a1} priority />
            </div>
          </div>
        </div>
      </section>

      <section id="enquire" aria-label="Check your date" style={{ paddingBottom: 72, scrollMarginTop: 120 }}>
        <div className={s.wrap}>
          <VenueEnquiryCard slug={v.slug} name={v.name} city={vendor.city} />
        </div>
      </section>

      <VenueGallery name={v.name} photos={v.photos} video={v.video} />

      {(v.about || v.events.length > 0) && (
        <section aria-labelledby="venue-about" className={s.section}>
          <div className={`${s.wrap} ${s.two}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p className={s.kicker}>About the venue</p>
              <h2 id="venue-about" className={s.h2} style={{ marginTop: 0 }}>About {v.name}</h2>
              {v.about && <p style={{ margin: 0, fontSize: 17, lineHeight: 1.75, color: '#4D3E36', whiteSpace: 'pre-line' }}>{v.about}</p>}
              {v.hours && <p style={{ margin: 0, fontSize: 15, color: '#4D3E36' }}><b style={{ color: '#221714' }}>Open:</b> {v.hours}</p>}
            </div>
            {v.events.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6B5A4E' }}>Good for</p>
                <ul className={s.chips} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {v.events.map((e) => <li key={e} className={s.chip}>{e}</li>)}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {v.spaces.length > 0 && (
        <section aria-labelledby="venue-spaces" className={`${s.section} ${s.white}`}>
          <div className={s.wrap} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div>
              <p className={s.kicker}>Halls and lawns</p>
              <h2 id="venue-spaces" className={s.h2}>Spaces at {v.name}</h2>
            </div>
            <div className={s.grid2}>
              {v.spaces.map((sp) => (
                <div key={sp.name} className={`${s.space} ${s.card3d}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className={s.spaceIcon}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.8" aria-hidden="true"><path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6" /></svg>
                    </span>
                    <div>
                      <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{sp.name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6B5A4E' }}>{sp.kind}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div className={s.num}><p>Seated</p><p>{sp.seated}</p></div>
                    <div className={s.num}><p>Maximum</p><p>{sp.max}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {v.amenities.length > 0 && (
        <section aria-labelledby="venue-facilities" className={s.section}>
          <div className={s.wrap} style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
            <div>
              <p className={s.kicker}>Facilities</p>
              <h2 id="venue-facilities" className={s.h2}>What you get</h2>
            </div>
            <ul className={s.grid3}>
              {v.amenities.map((a) => <li key={a} className={s.amenity}><Tick />{a}</li>)}
            </ul>
          </div>
        </section>
      )}

      {v.packages.length > 0 && (
        <section aria-labelledby="venue-packages" className={`${s.section} ${s.dark}`}>
          <div className={s.wrap} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div>
              <p className={s.kicker}>Packages and prices</p>
              <h2 id="venue-packages" className={s.h2}>Real prices from {v.name}</h2>
            </div>
            <div className={s.pkGrid}>
              {v.packages.map((p) => {
                const pkg = pkgById.get(p.id);
                return (
                  <div key={p.id} className={`${s.pk} ${s.card3d}`}>
                    <p style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{p.name}</p>
                    <p className={s.pkPrice}>{p.price}{p.unit && <span> {p.unit}</span>}</p>
                    {p.points.length > 0 && <ul className={s.pkPoints}>{p.points.map((pt) => <li key={pt}>{pt}</li>)}</ul>}
                    {pkg && <VenuePackageButton vendor={vendor} pkg={pkg} />}
                  </div>
                );
              })}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#D9CBB8' }}>Prices as listed by the venue. Your Wedding Expert confirms the final quotation for your date and guest count.</p>
          </div>
        </section>
      )}

      {verified && verified.reviews.length > 0 && (
        <section aria-labelledby="venue-reviews" className={s.section}>
          <div className={s.wrap} style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 900 }}>
            <p className={s.kicker}>{VERIFIED_REVIEWS_LABEL}</p>
            <h2 id="venue-reviews" className={s.h2} style={{ marginTop: 0 }}>From couples who booked {v.name}</h2>
            {verified.reviews.map((r, i) => (
              <figure key={i} className={s.review} style={{ margin: 0 }}>
                {r.comment && <blockquote style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: '#4D3E36', whiteSpace: 'pre-line' }}>{r.comment}</blockquote>}
                <figcaption style={{ marginTop: 8, fontSize: 14, fontWeight: 700 }}>
                  {r.authorName} · {r.rating}/5 <span style={{ fontWeight: 400, color: '#2F6B45' }}>· booked through Shaadi Shopping, {new Date(r.date).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="venue-location" className={s.section}>
        <div className={`${s.wrap} ${s.two}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p className={s.kicker}>Location</p>
            <h2 id="venue-location" className={s.h2} style={{ marginTop: 0 }}>Getting there</h2>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.7, color: '#4D3E36' }}>{v.address}</p>
            <a href={v.mapsLink} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, fontSize: 15, color: '#7A1238' }}>Open in Google Maps</a>
          </div>
          <div className={s.map}>
            {v.mapEmbedUrl ? (
              <iframe src={v.mapEmbedUrl} title={`Map of ${v.name}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            ) : (
              <p style={{ margin: 0, padding: 24 }}>{v.place}</p>
            )}
          </div>
        </div>
      </section>

      {v.faqs.length > 0 && (
        <section aria-labelledby="venue-faqs" className={`${s.section} ${s.faqBand}`}>
          <div className={s.wrap} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 900 }}>
            <h2 id="venue-faqs" className={s.h2} style={{ marginTop: 0, marginBottom: 8 }}>Questions about {v.name}</h2>
            {v.faqs.map((q, i) => (
              <details key={q.q} className={s.faq} open={i === 0}>
                <summary>{q.q}</summary>
                <p>{q.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Arrange a visit" className={s.section}>
        <div className={s.wrap}>
          <div className={s.final}>
            <div>
              <p className={s.serif} style={{ margin: 0, fontSize: 40, lineHeight: 1.05 }}>Like {v.name}?</p>
              <p style={{ margin: '8px 0 0', fontSize: 16, color: '#F3E3C3' }}>We arrange the visit and get you the quotation. Free for families.</p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <a href="#enquire" className={s.finalBtn}>Arrange a visit</a>
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={s.finalBtn} style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.5)' }}>WhatsApp us</a>
            </div>
          </div>
        </div>
      </section>

      <div className={s.bar}>
        <a href="#enquire" style={{ flex: 1, background: '#7A1238', color: '#fff' }}>Check date and price</a>
        <a href={`tel:${SHAADI_PHONE}`} style={{ padding: '0 18px', border: '1px solid #EADFCC', color: '#221714' }}>Call</a>
      </div>
    </div>
  );
}
