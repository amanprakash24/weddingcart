import type { WorkspaceDocument } from './types';

// Read-only for this pass — upload needs a real Cloudinary signed-upload flow
// (same temp-folder-then-promote pattern as vendor onboarding), which is a
// genuinely separate piece of work, not a quick add-on. Listed here as an
// empty-safe placeholder rather than shipping a button that doesn't work.
export default function Documents({ documents }: { documents: WorkspaceDocument[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Documents</h2>
      {documents.length === 0 ? (
        <p className="text-sm text-gray-400">No documents uploaded yet.</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between text-sm">
              <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline">
                {d.fileName}
              </a>
              <span className="text-xs text-gray-400">{d.category}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
