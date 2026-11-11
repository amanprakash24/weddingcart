/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import { guardDom } from './domGuard';

// A tiny stand-in for a DOM node whose real methods throw like the browser does.
class FakeNode {
  parentNode: FakeNode | null = null;
  children: FakeNode[] = [];
  removeChild<T extends FakeNode>(child: T): T {
    const i = this.children.indexOf(child);
    if (i < 0) throw new Error("NotFoundError: Failed to execute 'removeChild' on 'Node'");
    this.children.splice(i, 1);
    child.parentNode = null;
    return child;
  }
  insertBefore<T extends FakeNode>(node: T, ref: FakeNode | null): T {
    const i = ref ? this.children.indexOf(ref) : this.children.length;
    if (i < 0) throw new Error("NotFoundError: Failed to execute 'insertBefore' on 'Node'");
    this.children.splice(i, 0, node);
    node.parentNode = this;
    return node;
  }
}
guardDom(FakeNode.prototype as never);

function parentWith(...kids: FakeNode[]) {
  const p = new FakeNode();
  for (const k of kids) p.insertBefore(k, null);
  return p;
}

describe('a translated page does not crash', () => {
  test('removing a node that translation already moved is skipped', () => {
    const text = new FakeNode();
    const p = parentWith(text);
    const translator = parentWith();
    p.removeChild(text);
    translator.insertBefore(text, null); // translation moved the text elsewhere
    expect(() => p.removeChild(text)).not.toThrow();
    expect(translator.children).toContain(text);
  });

  test('inserting before a node that translation moved is skipped', () => {
    const moved = new FakeNode();
    const p = parentWith();
    parentWith(moved);
    expect(() => p.insertBefore(new FakeNode(), moved)).not.toThrow();
  });

  test('normal removes and inserts still work', () => {
    const a = new FakeNode();
    const b = new FakeNode();
    const p = parentWith(a);
    p.insertBefore(b, a);
    expect(p.children).toEqual([b, a]);
    p.removeChild(a);
    expect(p.children).toEqual([b]);
  });

  test('guarding twice does not wrap twice', () => {
    const before = FakeNode.prototype.removeChild;
    guardDom(FakeNode.prototype as never);
    expect(FakeNode.prototype.removeChild).toBe(before);
  });
});
