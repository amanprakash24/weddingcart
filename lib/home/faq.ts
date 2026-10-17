// One list for the homepage FAQ: shown on the page (components/home/HomeFaq.tsx) AND sent as FAQPage
// structured data (app/page.tsx). Google expects the two to match, so never add an answer to only one.
// No claims we cannot back up (e.g. "every vendor is verified").
export const HOME_FAQ: { q: string; a: string }[] = [
  {
    q: 'What does ShaadiShopping do for a wedding in Patna?',
    a: 'ShaadiShopping plans your wedding with you around your budget and guest count. One wedding expert from our Patna team helps you choose a venue, caterer, decorator, photographer, makeup artist and other services, arranges visits and quotations, and stays with you until the vidai.',
  },
  {
    q: 'How much does a wedding cost in Patna?',
    a: 'It depends mostly on the guest count, the venue and the menu. Many families in Patna plan between ₹5 lakh and ₹25 lakh, and larger weddings go well beyond that. Tell us your budget and we suggest venues and vendors that fit it.',
  },
  {
    q: 'Which wedding venues can I book through ShaadiShopping?',
    a: 'Banquet halls, lawns and resorts across Patna, including Danapur, Bailey Road, Boring Road, Kankarbagh and Saguna Mor. Each venue page shows its photos, capacity and starting price, and you can send an enquiry from it.',
  },
  {
    q: 'Is ShaadiShopping free for couples?',
    a: 'Yes. Browsing, enquiries and the consultation with our wedding expert are free for couples.',
  },
  {
    q: 'How do I book a venue through ShaadiShopping?',
    a: 'Send an enquiry from a venue page, start your plan on the "Begin your journey" page, or call +91 76460 28228. Our expert understands what you need, shortlists venues, arranges site visits and helps you confirm the booking.',
  },
  {
    q: 'Do you plan weddings outside Patna?',
    a: 'Our team and most of our vendors are in Patna. We also help families from other Bihar cities such as Muzaffarpur, Gaya, Bhagalpur and Darbhanga who are planning a wedding with Patna vendors.',
  },
  {
    q: 'How is ShaadiShopping different from a listing website?',
    a: 'A listing site gives you phone numbers. We give you one person who plans with you: shortlisting, visits, quotations, coordination with vendors and support on the wedding days.',
  },
];
