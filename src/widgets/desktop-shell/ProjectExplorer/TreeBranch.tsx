import type { DragEvent, MouseEvent } from 'react';
import { writeLibraryPayload } from '../../../shared/lib/libraryDrag';
import { classNames } from '../../../shared/lib/utils';
import { isGpssEntityItem, isLibraryItem, type TreeNode } from './explorerTrees';

interface TreeBranchProps {
  node: TreeNode;
  level: number;
  selectedNodeId: string;
  collapsedNodeIds: string[];
  /** While searching every matching branch is shown expanded. */
  forceExpanded: boolean;
  onFocus: (nodeId: string) => void;
  onOpen: (node: TreeNode) => void;
  onToggle: (nodeId: string) => void;
}

function TreeIcon({ node }: { node: TreeNode }) {
  if (node.tebIconShape) {
    return <span className={`tree-row__teb-icon tree-row__teb-icon--${node.tebIconShape}`} aria-hidden="true" />;
  }

  if (node.iconAsset) {
    return <img className="tree-row__img" src={node.iconAsset} alt="" aria-hidden="true" />;
  }

  return <span className={`tree-row__icon tree-row__icon--${node.icon}`} />;
}

export function TreeBranch(props: TreeBranchProps) {
  const { node, level, selectedNodeId, collapsedNodeIds, forceExpanded, onFocus, onOpen, onToggle } = props;
  const hasChildren = Boolean(node.children?.length);
  const isCollapsed = hasChildren && !forceExpanded && collapsedNodeIds.includes(node.id);
  const isDraggable = isLibraryItem(node.id);

  function handleRowClick() {
    onFocus(node.id);

    if (isDraggable) {
      return;
    }

    if (hasChildren && !forceExpanded) {
      onToggle(node.id);
      return;
    }

    onOpen(node);
  }

  function handleChevronClick(event: MouseEvent<HTMLSpanElement>) {
    if (!hasChildren) {
      return;
    }

    event.stopPropagation();
    onFocus(node.id);
    onToggle(node.id);
  }

  function handleDragStart(event: DragEvent<HTMLButtonElement>) {
    if (!isDraggable) {
      return;
    }

    const isEntity = isGpssEntityItem(node.id);
    writeLibraryPayload(event.dataTransfer, {
      id: node.id,
      label: node.label,
      icon: node.iconAsset,
      iconShape: node.tebIconShape ?? (isEntity ? undefined : 'rect'),
      kind: isEntity ? 'entity' : 'block',
    });
  }

  return (
    <div>
      <button
        className={classNames('tree-row', selectedNodeId === node.id && 'is-active', isDraggable && 'is-draggable')}
        style={{ ['--level' as string]: level }}
        type="button"
        draggable={isDraggable}
        title={isDraggable ? 'Перетащите элемент на структурную схему' : node.label}
        aria-expanded={hasChildren ? !isCollapsed : undefined}
        onClick={handleRowClick}
        onDragStart={handleDragStart}
      >
        <span
          className={classNames('tree-row__chevron', hasChildren && 'is-clickable', isCollapsed ? 'is-collapsed' : 'is-expanded')}
          aria-hidden="true"
          onClick={handleChevronClick}
        />
        <TreeIcon node={node} />
        <span className="tree-row__label" title={node.label}>
          {node.label}
        </span>
      </button>

      {isCollapsed ? null : node.children?.map((child) => <TreeBranch {...props} key={child.id} node={child} level={level + 1} />)}
    </div>
  );
}
