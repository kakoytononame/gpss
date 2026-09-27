import { useMemo, useState } from 'react';
import { useTebEditorStore } from '../../../features/teb-editor/store/useTebEditorStore';
import propertiesIcon from '../../../shared/assets/icons/gpss-native/properties_32.png';
import tebsPropertiesIcon from '../../../shared/assets/icons/gpss-native/tebsproperties_32.png';
import { PropertyValue } from './PropertyValue';
import { buildPropertyRows, filterPropertyRows, SHAPE_OPTIONS, type EditableSchemeField } from './propertyRows';

interface ShapeGalleryDialogProps {
  selectedShape?: string;
  onSelect: (shape: string) => void;
  onClose: () => void;
}

function ShapeGalleryDialog({ selectedShape, onSelect, onClose }: ShapeGalleryDialogProps) {
  return (
    <div className="property-modal-backdrop">
      <div className="property-shape-dialog" role="dialog" aria-modal="true" aria-label="Галерея форм тэба">
        <div className="property-shape-dialog__title">
          <span>Галерея форм тэба</span>
          <button type="button" aria-label="Закрыть" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="property-shape-dialog__body">
          {SHAPE_OPTIONS.map((shape) => (
            <button className={selectedShape === shape ? 'is-selected' : ''} key={shape} type="button" onClick={() => onSelect(shape)}>
              <span className="property-shape-preview" aria-hidden="true" />
              <span>{shape}</span>
            </button>
          ))}
        </div>
        <div className="property-shape-dialog__actions">
          <button type="button" onClick={onClose}>
            OK
          </button>
          <button type="button" onClick={onClose}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

/** Property grid for the element selected on the structural scheme. */
export function PropertiesView() {
  const teb = useTebEditorStore((state) => state.teb);
  const schemeSelection = useTebEditorStore((state) => state.schemeSelection);
  const schemeNodes = useTebEditorStore((state) => state.schemeNodes);
  const setSchemeNodes = useTebEditorStore((state) => state.setSchemeNodes);
  const saveWorkspaceSnapshot = useTebEditorStore((state) => state.saveWorkspaceSnapshot);
  const [search, setSearch] = useState('');
  const [shapeGalleryOpen, setShapeGalleryOpen] = useState(false);

  const selectedNode = schemeSelection?.type === 'node' ? (schemeNodes.find((node) => node.id === schemeSelection.id) ?? null) : null;
  const rows = useMemo(() => filterPropertyRows(buildPropertyRows(selectedNode, teb), search), [selectedNode, teb, search]);

  function updateSelectedNode(field: EditableSchemeField, value: string | number | boolean) {
    if (!selectedNode) {
      return;
    }

    setSchemeNodes(
      (nodes) => nodes.map((node) => (node.id === selectedNode.id ? { ...node, [field]: value } : node)),
      `Свойство "${field}" элемента схемы изменено.`,
    );
  }

  const persistWorkspace = () => void saveWorkspaceSnapshot();

  function applyShape(shape: string) {
    updateSelectedNode('shape', shape);
    setShapeGalleryOpen(false);
    persistWorkspace();
  }

  return (
    <div className="properties-view">
      <div className="properties-toolbar">
        <img src={propertiesIcon} alt="" aria-hidden="true" />
        <img src={tebsPropertiesIcon} alt="" aria-hidden="true" />
        <input type="search" placeholder="Поиск свойств" aria-label="Поиск свойств" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      <div className="properties-grid" role="table" aria-label="Свойства">
        {rows.map((row, index) =>
          row.kind === 'group' ? (
            <div className="property-group" role="row" key={`${row.title}-${index}`}>
              {row.title}
            </div>
          ) : (
            <div className="property-row" role="row" key={`${row.name}-${index}`}>
              <div className="property-name" role="cell">
                {row.name}
              </div>
              <div className="property-value" role="cell">
                <PropertyValue
                  row={row}
                  disabled={!selectedNode}
                  onChange={updateSelectedNode}
                  onCommit={persistWorkspace}
                  onOpenShapeGallery={() => setShapeGalleryOpen(true)}
                />
              </div>
            </div>
          ),
        )}
      </div>

      {shapeGalleryOpen ? <ShapeGalleryDialog selectedShape={selectedNode?.shape} onSelect={applyShape} onClose={() => setShapeGalleryOpen(false)} /> : null}
    </div>
  );
}
