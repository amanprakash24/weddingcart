import type { VendorBookingRow } from '@/lib/vendor/weddingsView';

// Human-language labels for venue setup status — shared by VendorServicesScreen and VendorWeddingsScreen
// (Venue Owner specialization, docs/wedding-os/11-vivah-os-ux-architecture.md §3/§20). Single source so the
// two screens can't drift apart in wording.
export const VENUE_STATUS_LABEL: Record<VendorBookingRow['venueStatus'], string> = {
  PENDING: 'Setup not started',
  READY_FOR_SETUP: 'Ready for setup',
  SETUP_IN_PROGRESS: 'Setup in progress',
  READY: 'Ready for the event',
  COMPLETED: 'Setup completed',
};

export const VENUE_ADVANCE_LABEL: Record<VendorBookingRow['venueStatus'], string> = {
  PENDING: 'Mark ready for setup',
  READY_FOR_SETUP: 'Start setup',
  SETUP_IN_PROGRESS: 'Mark setup ready',
  READY: 'Mark completed',
  COMPLETED: '',
};
