import { NextResponse } from 'next/server';

// Load balancer health check for the ECS deployment (docs/deployment/aws-migration-plan.md).
// Deliberately does NOT touch the database: if it did, a brief database blip would mark
// every healthy container unhealthy and the load balancer would keep replacing them.
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
}
