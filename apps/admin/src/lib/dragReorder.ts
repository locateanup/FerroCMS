import { useState, type DragEvent } from 'react';

/** Move the item at `from` to `to`, shifting everything between. */
export function reorder<T>(list: T[], from: number, to: number): T[] {
  const copy = list.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item as T);
  return copy;
}

/**
 * Minimal native-HTML5-drag-and-drop list reordering — no external DnD
 * library, matching this codebase's preference for plain CSS/DOM over
 * dependencies for one-off UI (see the calendar grid, block editor).
 * `handleProps(i)` goes on a small grip so dragging doesn't fight with
 * selecting text inside the row; `dropZoneProps(i)` goes on the row itself.
 */
export function useDragReorder(onReorder: (from: number, to: number) => void) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function handleProps(index: number) {
    return {
      draggable: true,
      onDragStart: () => setDragIndex(index),
      onDragEnd: () => setDragIndex(null),
    };
  }

  function dropZoneProps(index: number) {
    return {
      onDragOver: (e: DragEvent) => e.preventDefault(),
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        if (dragIndex !== null && dragIndex !== index) onReorder(dragIndex, index);
        setDragIndex(null);
      },
    };
  }

  return { dragIndex, handleProps, dropZoneProps };
}
