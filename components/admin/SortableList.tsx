"use client";

import { startTransition, useId, useState, type CSSProperties, type HTMLAttributes } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, rectSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

export type SortableItem = Readonly<{ id: string }>;

export type SortableRowRenderProps = Readonly<{
  setNodeRef: (node: HTMLElement | null) => void;
  style: CSSProperties;
  isDragging: boolean;
  dragHandleProps: HTMLAttributes<HTMLButtonElement>;
}>;

export type SortableListProps<T extends SortableItem> = Readonly<{
  items: readonly T[];
  onReorder: (nextOrderedIds: readonly string[]) => void;
  /** `"vertical"` (default) for stacked rows/tables; `"grid"` for a wrapping thumbnail grid (e.g. `MediaGalleryField`). */
  strategy?: "vertical" | "grid";
  /**
   * Render prop, not a wrapper - `SortableList` never injects its own DOM
   * element around an item. Spread `setNodeRef`/`style` onto whatever root
   * element the caller renders (a `<tr>` for tables, `<li>`/`<div>` for
   * lists/cards) so this drops into a `<tbody>` without becoming invalid
   * HTML - a `<div>` wrapper here previously broke every table-based list
   * that used one (documented incident, see Kurallar.md).
   */
  renderItem: (item: T, row: SortableRowRenderProps) => React.ReactNode;
}>;

/**
 * Shared drag-and-drop + keyboard reorder for every admin list (FR-15,
 * AD-9) - the only way any record's position changes; no numeric "sıra"
 * input exists anywhere. `PointerSensor` drives mouse/touch drag,
 * `KeyboardSensor` + `sortableKeyboardCoordinates` makes the same reorder
 * fully keyboard-operable (focus the handle, Space to pick up, arrow keys to
 * move, Space to drop, Escape to cancel - `dnd-kit`'s standard contract,
 * AC-FR15-03). `onReorder` always receives the complete new id order; the
 * caller's server action persists it atomically in one transaction.
 */
export function SortableList<T extends SortableItem>({ items, onReorder, renderItem, strategy = "vertical" }: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const contextId = useId();


  // `DndContext` otherwise emits its accessibility live region at the
  // consumer's exact DOM position. Portaling it to `document.body` keeps
  // SortableList valid inside constrained structures such as tables. The
  // lazy initializer preserves SSR without an effect-driven render pass.
  const [portalContainer] = useState<HTMLElement | undefined>(() =>
    typeof document === "undefined" ? undefined : document.body,
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const nextOrderedIds = arrayMove([...items], oldIndex, newIndex).map((item) => item.id);
    // `onReorder` commonly dispatches a `useActionState` action (every
    // current consumer does). Called synchronously from this dnd-kit
    // pointer/keyboard handler, React warns that the dispatch happened
    // outside a transition and `isPending` would not update correctly.
    // Wrapping here fixes it once for every consumer instead of requiring
    // each caller to remember to wrap its own `onReorder`.
    startTransition(() => onReorder(nextOrderedIds));
  };

  return (
    <DndContext
      id={contextId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{ container: portalContainer }}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={strategy === "grid" ? rectSortingStrategy : verticalListSortingStrategy}
      >
        {items.map((item) => (
          <SortableItemBridge key={item.id} id={item.id} item={item} renderItem={renderItem} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableItemBridge<T extends SortableItem>({
  id,
  item,
  renderItem,
}: {
  id: string;
  item: T;
  renderItem: (item: T, row: SortableRowRenderProps) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  const dragHandleProps: HTMLAttributes<HTMLButtonElement> = {
    ...attributes,
    ...listeners,
    "aria-label": "Sürükleyerek sırala",
    title: "Sürükleyerek sırala",
    className:
      "cursor-grab touch-none rounded p-1 text-brand-muted hover:bg-brand-page hover:text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary active:cursor-grabbing",
  };
  return <>{renderItem(item, { setNodeRef, style, isDragging, dragHandleProps })}</>;
}

/** Ready-made grip icon for `dragHandleProps` - `<button type="button" {...dragHandleProps}><SortableDragHandleIcon /></button>`. */
export function SortableDragHandleIcon() {
  return <GripVertical className="h-4 w-4" aria-hidden="true" />;
}
