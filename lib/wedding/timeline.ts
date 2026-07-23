// The default milestone sequence from docs/wedding-os/03-wedding-workspace.md
// §3 — "a reasonable default, not a fixed schema." Seeded once at conversion
// (services/weddingConversion.service.ts) so a coordinator never lands on an
// empty Wedding Workspace; every milestone stays freely editable/removable
// afterward, this is just the starting template.
export const DEFAULT_MILESTONE_SEQUENCE: string[] = [
  'Lead Won',
  'Consultation Complete',
  'Venue Booked',
  'Photography Booked',
  'Decoration Finalized',
  'Catering Confirmed',
  'Invitation Sent',
  'Guest RSVPs',
  'Final Payment',
  'Wedding Day',
  'Post-event Review',
];
