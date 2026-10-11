'use client';

import ErrorScreen from '@/components/ErrorScreen';

// The couple's link when it fails to load. Whose link it is — a business's own, or Shaadi Shopping's — is not known here (that is
// what failed to load), so no number is shown: a business's own couple is never pointed to Shaadi Shopping's number (D8).
export default function ProposalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <ErrorScreen
      error={error}
      retry={unstable_retry}
      where="proposal"
      title="Your proposal could not be opened just now"
      contact={{ words: 'please contact whoever sent you this link — your proposal is safe.' }}
    />
  );
}
