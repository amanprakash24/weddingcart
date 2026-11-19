import Image from 'next/image';
import Link from 'next/link';
import type { Vendor } from '@/types';
import type { VendorView } from '@/lib/listing/vendorView';
import type { ListingSection } from '@/lib/listing/categoryTemplates';
import { categoryHref } from '@/lib/home/categoryTiles';
import { SHAADI_PHONE, shaadiWhatsAppLink } from '@/lib/shaadiContact';
import { ONLINE_RATING_LABEL, VERIFIED_REVIEWS_LABEL } from '@/lib/reviews/reviewView';
import type { VerifiedReviews } from './VenuePage';
import VenueEnquiryCard from './VenueEnquiryCard';
import VenueGallery from './VenueGallery';
import VenuePackageButton from './VenuePackageButton';
import s from './venue.module.css';

// THE master page for every non-venue listing (photographers, caterers, decorators, makeup, DJs, …), founder-approved
// 19 Nov 2026. Same frame and parts as the venue page; the category's template (lib/listing/categoryTemplates.ts)
// sets its words and the order of its three own sections. Listings in one category always look the same.
// Couples contact Shaadi Shopping, never the vendor directly.
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

export default function VendorListingPage({ view: v, vendor, category, verified }: { view: VendorView; vendor: Vendor; category: string; verified: VerifiedReviews | null }) {
  const t = v.template;
  const whatsapp = shaadiWhatsAppLink(`Hi, I am interested in ${v.name} (${t.label.toLowerCase()}) for my wedding. Please help me with the date and price.`);
  // Side arches only for real extra photos: one photo is never repeated to fill the stack.
  const [p1, p2, p3] = v.photos;
  const pkgById = new Map(vendor.packages.map((p) => [p.id, p]));

  const sections: Record<ListingSection, React.ReactNode> = {
    gallery: <VenueGallery key="gallery" name={v.name} photos={v.photos} video={v.video} kicker={t.galleryKicker} title={t.galleryTitle} id="listing-photos" />,
    packages: v.packages.length > 0 ? (
      <section key="packages" aria-labelledby="listing-packages" className={`${s.section} ${s.dark}`}>
        <div className={s.wrap} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div>
            <p className={s.kicker}>{t.packagesKicker}</p>
            <h2 id="listing-packages" className={s.h2}>{t.packagesTitle} from {v.name}</h2>
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
          <p style={{ margin: 0, fontSize: 13, color: '#D9CBB8' }}>Prices as listed by {v.name}. Your Wedding Expert confirms the final price for your date.</p>
        </div>
      </section>
    ) : null,
    features: v.features.length > 0 ? (
      <section key="features" aria-labelledby="listing-features" className={s.section}>
        <div className={s.wrap} style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div>
            <p className={s.kicker}>Details</p>
            <h2 id="listing-features" className={s.h2}>{t.featuresTitle}</h2>
          </div>
          <ul className={s.grid3}>
            {v.features.map((f) => <li key={f} className={s.amenity}><Tick />{f}</li>)}
          </ul>
        </div>
      </section>
    ) : null,
  };

  return (
    <div className={s.page}>
      <section aria-labelledby="listing-name" className={s.hero}>
        <div className={s.wrap}>
          <nav aria-label="Breadcrumb" className={s.crumbs}>
            <Link href="/">Home</Link><span aria-hidden="true">›</span>
            <Link href={categoryHref(category)}>{t.plural}</Link><span aria-hidden="true">›</span>
            <span style={{ color: '#221714', fontWeight: 600 }}>{v.name}</span>
          </nav>
          <div className={s.heroGrid}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <p className={s.kicker}>{t.label}</p>
              <h1 id="listing-name" className={s.h1}>{v.name}</h1>
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
              <Arch src={p1} alt={v.name} className={s.a1} priority />
            </div>
          </div>
        </div>
      </section>

      <section id="enquire" aria-label="Check your date" style={{ paddingBottom: 72, scrollMarginTop: 120 }}>
        <div className={s.wrap}>
          <VenueEnquiryCard
            slug={v.slug}
            name={v.name}
            city={vendor.city}
            category={category}
            title={`Check if ${v.name} is free on your date`}
            subtitle={`Your Wedding Expert confirms the date and price with ${v.name}.`}
          />
        </div>
      </section>

      {t.order.map((key) => sections[key])}

      {v.about && (
        <section aria-labelledby="listing-about" className={`${s.section} ${s.white}`}>
          <div className={s.wrap} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900 }}>
            <p className={s.kicker}>About</p>
            <h2 id="listing-about" className={s.h2} style={{ marginTop: 0 }}>About {v.name}</h2>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.75, color: '#4D3E36', whiteSpace: 'pre-line' }}>{v.about}</p>
          </div>
        </section>
      )}

      {verified && verified.reviews.length > 0 && (
        <section aria-labelledby="listing-reviews" className={s.section}>
          <div className={s.wrap} style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 900 }}>
            <p className={s.kicker}>{VERIFIED_REVIEWS_LABEL}</p>
            <h2 id="listing-reviews" className={s.h2} style={{ marginTop: 0 }}>From couples who booked {v.name}</h2>
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

      {v.faqs.length > 0 && (
        <section aria-labelledby="listing-faqs" className={`${s.section} ${s.faqBand}`}>
          <div className={s.wrap} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 900 }}>
            <h2 id="listing-faqs" className={s.h2} style={{ marginTop: 0, marginBottom: 8 }}>Questions about {v.name}</h2>
            {v.faqs.map((q, i) => (
              <details key={q.q} className={s.faq} open={i === 0}>
                <summary>{q.q}</summary>
                <p>{q.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Book through Shaadi Shopping" className={s.section}>
        <div className={s.wrap}>
          <div className={s.final}>
            <div>
              <p className={s.serif} style={{ margin: 0, fontSize: 40, lineHeight: 1.05 }}>Like {v.name}?</p>
              <p style={{ margin: '8px 0 0', fontSize: 16, color: '#F3E3C3' }}>We check their date and get you the price. Free for families.</p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <a href="#enquire" className={s.finalBtn}>Check their date</a>
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
