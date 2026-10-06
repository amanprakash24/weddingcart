import { NextResponse } from 'next/server';
import { statsService } from '@/services/stats.service';
import { requireAdmin } from '@/lib/adminAuth';
import { platformScoped } from '@/lib/ownership/entry';

async function handleGET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const data = await statsService.get();
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('GET /api/stats failed:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch stats' }, { status: 500 });
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
