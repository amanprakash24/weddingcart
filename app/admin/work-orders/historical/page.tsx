import HistoricalWorkOrdersClient from '@/components/workOrder/HistoricalWorkOrdersClient';

export const metadata = {
  title: 'Work orders for earlier confirmations — Admin',
  robots: { index: false, follow: false },
};

// Founder only (the API refuses everyone else). Read-only preview; only ticked rows are issued, after a confirmation step.
export default function HistoricalWorkOrdersPage() {
  return <HistoricalWorkOrdersClient />;
}
