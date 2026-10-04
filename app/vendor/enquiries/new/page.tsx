import NewEnquiryForm from '@/components/vendor/enquiries/NewEnquiryForm';

// "+ New Enquiry" in Vendor OS (Phase C). The form saves through the venue-scoped API; this page reads no data itself.
export const metadata = { title: 'New enquiry | Vivah OS', robots: { index: false, follow: false } };

export default function NewEnquiryPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <NewEnquiryForm />
    </div>
  );
}
