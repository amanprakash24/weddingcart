// The liquid glass backdrop (the founder approved, 11 Nov 2026) behind Venue OS, Vendor OS and Client OS: a soft lavender ground
// with purple, pink and sky glows and the Vivah OS mandap, fixed so it stays put while the page scrolls. The glass above it
// (.os-glass, app/globals.css) picks up its colour. Must sit inside an `.os-theme relative isolate` wrapper.
export default function OsBackdrop() {
  return (
    <div aria-hidden className="os-backdrop pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <span className="os-orb -left-24 -top-24 h-[28rem] w-[28rem] bg-[#A78BFA] opacity-55" />
      <span className="os-orb -right-20 top-1/4 h-[24rem] w-[24rem] bg-[#F9A8D4] opacity-45" />
      <span className="os-orb bottom-[-8rem] left-1/3 h-[26rem] w-[26rem] bg-[#7DD3FC] opacity-40" />
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative brand mark in the backdrop */}
      <img src="/images/vivah-os/mark-large.png" alt="" className="absolute bottom-[-6rem] right-[-4rem] h-[34rem] w-auto opacity-[0.07]" />
    </div>
  );
}
