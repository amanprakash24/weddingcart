import WorkspaceChooser from '@/components/WorkspaceChooser';

// "Choose Workspace" — where a person lands right after signing in with their mobile number and code. The screen loads their
// memberships through /api/workspace; this page reads no data itself.
export const metadata = { title: 'Choose workspace | Shaadi Shopping', robots: { index: false, follow: false } };

export default function WorkspacePage() {
  return <WorkspaceChooser />;
}
