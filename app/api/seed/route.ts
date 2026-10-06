import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { seedService } from '@/services/seed.service';
import { platformScoped } from '@/lib/ownership/entry';

// Lockdown per docs/database/postgres-migration-plan.md's "Decision 1 —
// /api/seed lockdown": never accessible in production regardless of
// session, SUPER_ADMIN-only elsewhere, and requires an explicit
// SEED_ENABLED=true env var as a second safeguard so a stray staging
// deploy or misconfigured session can't trigger a reseed.
async function handlePOST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const session = await requireRole([Role.SUPER_ADMIN]);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (process.env.SEED_ENABLED !== 'true') {
    return NextResponse.json(
      { success: false, error: 'Seeding is disabled (set SEED_ENABLED=true to enable)' },
      { status: 403 }
    );
  }

  try {
    const blogsInserted = await seedService.seedBlogs();
    return NextResponse.json({
      success: true,
      message: `Seeded ${blogsInserted} blog posts. Category/vendor reseeding has been removed — see docs/database/postgres-migration-plan.md.`,
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

async function handleGET() {
  return NextResponse.json({ message: 'Use POST to seed blog posts (categories/vendors are no longer reseeded)' });
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
export const GET = platformScoped(handleGET);
