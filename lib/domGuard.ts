// Chrome's "Translate this page" (and extensions such as Grammarly) swap the page's text nodes for their own. When React
// later updates that part of the page, the node it remembers has been moved, and the browser throws
// "Failed to execute 'removeChild' / 'insertBefore' on 'Node'" — the whole page falls to "Something went wrong".
// Seen on /admin/errors, 2 Nov 2026. The known workaround (facebook/react#11538): when the node is not where React
// expects it, skip the step instead of throwing. The page keeps working; at worst one bit of text stays stale.

type NodeLike = { parentNode: unknown };
type NodeProto = {
  removeChild<T extends NodeLike>(this: unknown, child: T): T;
  insertBefore<T extends NodeLike>(this: unknown, node: T, ref: NodeLike | null): T;
};

const GUARDED = Symbol.for('shaadi.domGuard');

export function guardDom(proto: NodeProto): void {
  const marked = proto as NodeProto & { [GUARDED]?: true };
  if (marked[GUARDED]) return;
  marked[GUARDED] = true;

  const removeChild = proto.removeChild;
  proto.removeChild = function <T extends NodeLike>(this: unknown, child: T): T {
    if (child.parentNode !== this) return child;
    return removeChild.call(this, child) as T;
  };

  const insertBefore = proto.insertBefore;
  proto.insertBefore = function <T extends NodeLike>(this: unknown, node: T, ref: NodeLike | null): T {
    if (ref && ref.parentNode !== this) return node;
    return insertBefore.call(this, node, ref) as T;
  };
}

/** In the visitor's browser only; does nothing on the server. */
export function guardBrowserDom(): void {
  if (typeof window === 'undefined' || typeof Node === 'undefined') return;
  guardDom(Node.prototype as unknown as NodeProto);
}
