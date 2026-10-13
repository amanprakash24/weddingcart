// HTTP handlers for vendor enquiries (04-vendor-os.md §9), as factories with their dependencies passed in, so they can
// be tested without replacing shared modules. The route files only wire in the real session check and service.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/lib/errors';
import { isSourceType } from '@/lib/crm/subject';
import { STAFF_CHANNELS, ANSWER_STATUSES, type AnswerInput, type StaffChannel } from '@/lib/vendorEnquiry/rules';
import type { SourceType } from '@/services/leadInbox.service';

type Session = { user: { id?: string | null; roles?: string[] } } | null;

export interface StaffDeps {
  requireAdmin: () => Promise<Session>;
  listForSource: (sourceType: SourceType, sourceId: string) => Promise<unknown>;
  answerAsStaff: (id: string, input: AnswerInput, channel: StaffChannel, actorId: string | null) => Promise<unknown>;
}
export interface VendorDeps {
  // The vendor the signed-in person is working in and may answer for, or the answer to send back (lib/auth/workingVendor.ts).
  vendor: () => Promise<{ who: { vendorId: string; userId: string } } | { refused: Response }>;
  answerAsVendor: (who: { vendorId: string; userId: string }, id: string, input: AnswerInput) => Promise<unknown>;
}

const unauthorized = () => NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
const NO_STORE = { 'Cache-Control': 'no-store' };

const answerSchema = z.object({
  status: z.enum(ANSWER_STATUSES as [string, ...string[]]),
  note: z.string().max(1000).nullish(),
  suggestedDate: z.string().max(60).nullish(),
  quotedAmount: z.union([z.number(), z.string()]).nullish(),
});
const staffAnswerSchema = answerSchema.extend({ channel: z.enum(STAFF_CHANNELS) });

// GET /api/crm/vendor-enquiries?sourceType=CONSULTATION&sourceId=<id> — staff: the enquiries for one customer record.
export function makeListForSource(deps: StaffDeps) {
  return async (req: NextRequest) => {
    if (!(await deps.requireAdmin())) return unauthorized();
    try {
      const sourceType = req.nextUrl.searchParams.get('sourceType') ?? '';
      const sourceId = req.nextUrl.searchParams.get('sourceId') ?? '';
      if (!isSourceType(sourceType) || !sourceId) return NextResponse.json({ success: false, error: 'sourceType and sourceId are required' }, { status: 400 });
      return NextResponse.json({ success: true, data: await deps.listForSource(sourceType, sourceId) }, { headers: NO_STORE });
    } catch (err) {
      return handleApiError(err);
    }
  };
}

// POST /api/crm/vendor-enquiries/[id]/answer — staff record the vendor's answer and how it reached them.
export function makeStaffAnswer(deps: StaffDeps) {
  return async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await deps.requireAdmin();
    if (!session) return unauthorized();
    try {
      const { channel, ...input } = staffAnswerSchema.parse(await req.json());
      const status = await deps.answerAsStaff((await params).id, input, channel, session.user.id ?? null);
      return NextResponse.json({ success: true, data: { status } }, { headers: NO_STORE });
    } catch (err) {
      return handleApiError(err);
    }
  };
}

// POST /api/vendor/enquiries/[id] — an enquiry of the vendor the signed-in person is working in is answered.
export function makeVendorAnswer(deps: VendorDeps) {
  return async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const gate = await deps.vendor();
    if ('refused' in gate) return gate.refused;
    try {
      const input = answerSchema.parse(await req.json());
      return NextResponse.json({ success: true, data: await deps.answerAsVendor({ vendorId: gate.who.vendorId, userId: gate.who.userId }, (await params).id, input) }, { headers: NO_STORE });
    } catch (err) {
      return handleApiError(err);
    }
  };
}
