import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { enquiryPageService } from '@/services/enquiryPage.service';
import EnquiryPageForm from '@/components/enquire/EnquiryPageForm';
import VivahOsLogo from '@/components/vivah-os/VivahOsLogo';

// A venue's own public enquiry page (11 Nov 2026, Vivah OS phase 1). The venue's brand, "Powered by Vivah OS" (D8) — none of Shaadi
// Shopping's site chrome (lib/proposalPath.ts). Shows only what the venue already shows the public (name, logo, city); the form
// sends through /api/enquire/[slug] into the venue's own Enquiries. Not indexed: it is a form, not a listing.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await enquiryPageService.profile((await params).slug);
  return {
    title: { absolute: page ? `Send an enquiry to ${page.name}` : 'Enquiry page not found' },
    robots: { index: false, follow: false },
  };
}

export default async function EnquiryPage({ params }: Props) {
  const { slug } = await params;
  const page = await enquiryPageService.profile(slug);
  if (!page) notFound();

  return (
    <div className="min-h-screen bg-[#F7F0E6] text-[#2A1F1B]">
      <header className="bg-[#2E0A16] px-5 pb-10 pt-8 text-white sm:px-8">
        <div className="mx-auto flex max-w-[560px] items-center gap-4">
          {page.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- the venue's own upload on our Cloudinary
            <img src={page.logoUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl bg-white object-contain p-1.5" />
          ) : (
            <div aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[#7A1238] font-cormorant text-3xl font-semibold">
              {page.name.trim().charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[#E9C98E]">SEND AN ENQUIRY</p>
            <h1 className="mt-1 font-cormorant text-[2rem] font-semibold leading-[1.05] sm:text-[2.4rem]">{page.name}</h1>
            {page.city && <p className="mt-1 text-sm text-[#D9CBB8]">{page.city}</p>}
          </div>
        </div>
      </header>

      <main className="relative -mt-5 rounded-t-3xl bg-[#F7F0E6] px-5 pb-10 pt-7 sm:px-8">
        <div className="mx-auto max-w-[560px]">
          <EnquiryPageForm slug={slug} venueName={page.name} />
          <footer className="mt-10 flex flex-col items-center gap-2 text-center text-xs text-[#8A7A6D]">
            <span>Powered by</span>
            <VivahOsLogo size={28} byline={false} />
          </footer>
        </div>
      </main>
    </div>
  );
}
