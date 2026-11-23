// What a public vendor listing shows (23 Nov 2026). Pure, so approval, the page and the tests share one answer.

// The photos a listing is published with: the cover if there is one, then what the vendor uploaded, each once.
export function listingPhotos(cover: string | null | undefined, uploaded: readonly string[] | null | undefined, fallback: string): { image: string; images: string[] } {
  const images = [...new Set([cover ?? '', ...(uploaded ?? [])].map((u) => u.trim()).filter(Boolean))];
  return images.length ? { image: images[0], images } : { image: fallback, images: [fallback] };
}

// "Starting from": the lowest package, or the vendor's own starting price when it has no packages (Math.min of nothing is Infinity).
export function startingPrice(priceMin: number, packagePrices: readonly number[], perPlate: boolean): number {
  return perPlate || packagePrices.length === 0 ? priceMin : Math.min(...packagePrices);
}

export type DescriptionBlock = { kind: 'heading' | 'paragraph'; text: string };

const withoutStars = (text: string) => text.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

// Vendors paste descriptions with **bold** titles. A line that is wholly bold is a heading; stars are never shown.
export function descriptionBlocks(description: string | null | undefined): DescriptionBlock[] {
  return (description ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => withoutStars(line))
    .map((line) => ({ kind: /^\*\*[^*]+\*\*:?$/.test(line) ? ('heading' as const) : ('paragraph' as const), text: withoutStars(line) }));
}

// The same description as one plain line, for search results and structured data.
export const plainDescription = (description: string | null | undefined) => withoutStars(description ?? '');
