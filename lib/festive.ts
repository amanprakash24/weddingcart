// The festive-season look of the homepage (Oct–Nov 2026: Dussehra, Diwali, Chhath).
//
// ONE SWITCH. To take the festive look off, set FESTIVE_ENABLED to false here — or, without a code change, set the environment
// variable NEXT_PUBLIC_FESTIVE_THEME=off (Vercel → Settings → Environment Variables) and redeploy.
//
// Off means: the hero, the benefits row and the announcement bar go back to their everyday wording, and every garland, diya and
// light disappears. Nothing else depends on it — vendors, categories, the Vivah OS section and page, planning and every wedding
// screen are the same either way.
const FESTIVE_ENABLED = true;

export const festive = {
  enabled: FESTIVE_ENABLED && process.env.NEXT_PUBLIC_FESTIVE_THEME !== 'off',
  announcement: 'Shubh Wedding Season · From Venue to Vidai',
  hero: {
    eyebrow: 'Wedding Season, Made More Special',
    headline: ['Your Dream Wedding', 'Starts Here.'],
    supporting: 'Discover wedding venues and trusted vendors in Patna, with expert support to help you plan your celebration.',
  },
} as const;
