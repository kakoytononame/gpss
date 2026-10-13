import { useEffect, useState } from 'react';
import { schemeAtPath } from '../../../features/teb-editor/model/projectScheme';
import { useTebEditorStore } from '../../../features/teb-editor/store/useTebEditorStore';
import type { StudioTebPort } from '../../../shared/types/project';

function portLabel(port: StudioTebPort, kind: 'Вход' | 'Выход'): string {
  const binding = port.Mode === 'Label' ? port.Label : port.Mode === 'FirstBlock' ? 'первый блок' : port.Mode === 'LastBlock' ? 'последний блок' : 'не указан';
  return `${kind} №${port.Id} (${binding})`;
}

interface LinkPropertiesViewProps {
  linkId: string;
}

/** Properties of a connection of the open project: ports, priority, probability, description and model. */
export function LinkPropertiesView({ linkId }: LinkPropertiesViewProps) {
  const scheme = useTebEditorStore((state) => schemeAtPath(state.project?.Models[state.projectModelIndex], state.schemePath));
  const flushSchemeToProject = useTebEditorStore((state) => state.flushSchemeToProject);
  const updateProjectLink = useTebEditorStore((state) => state.updateProjectLink);
  const link = scheme?.Links.find((item) => item.Id === linkId);

  // A connection drawn on the scheme exists in the project only after the scheme is written into it.
  useEffect(() => {
    if (!link) {
      flushSchemeToProject();
    }
  }, [link, flushSchemeToProject]);

  if (!scheme || !link) {
    return <p className="link-properties__empty">Связь не найдена в проекте.</p>;
  }

  const from = scheme.Nodes.find((node) => node.Id === link.FromNodeId);
  const to = scheme.Nodes.find((node) => node.Id === link.ToNodeId);

  return (
    <div className="link-properties" aria-label="Свойства связи">
      <div className="property-group">Связь</div>
      <label className="link-properties__row">
        <span>Откуда</span>
        <select aria-label="Выход ТЭБа" value={link.FromPortId} onChange={(event) => updateProjectLink(linkId, { FromPortId: Number(event.target.value) })}>
          {(from?.Outputs ?? []).map((port) => (
            <option key={port.Id} value={port.Id}>
              {from?.Header}: {portLabel(port, 'Выход')}
            </option>
          ))}
        </select>
      </label>
      <label className="link-properties__row">
        <span>Куда</span>
        <select aria-label="Вход ТЭБа" value={link.ToPortId} onChange={(event) => updateProjectLink(linkId, { ToPortId: Number(event.target.value) })}>
          {(to?.Inputs ?? []).map((port) => (
            <option key={port.Id} value={port.Id}>
              {to?.Header}: {portLabel(port, 'Вход')}
            </option>
          ))}
        </select>
      </label>
      <label className="link-properties__row">
        <span>Приоритет</span>
        <input
          aria-label="Приоритет связи"
          type="number"
          value={link.Priority}
          onChange={(event) => updateProjectLink(linkId, { Priority: Number(event.target.value) || 0 })}
        />
      </label>
      <label className="link-properties__row">
        <span>Вероятность</span>
        <input
          aria-label="Вероятность связи"
          type="number"
          min={0}
          step={0.05}
          value={link.Probability}
          onChange={(event) => updateProjectLink(linkId, { Probability: Math.max(0, Number(event.target.value) || 0) })}
        />
      </label>
      <label className="link-properties__row">
        <span>Описание</span>
        <input
          aria-label="Описание связи"
          value={link.Description ?? ''}
          onChange={(event) => updateProjectLink(linkId, { Description: event.target.value || null })}
        />
      </label>
      <div className="property-group">Модель связи</div>
      <LinkModelEditor
        key={`${linkId}:${link.GpssText ?? ''}`}
        initial={link.GpssText ?? ''}
        onCommit={(text) => updateProjectLink(linkId, { GpssText: text.trim() ? text : null })}
      />
    </div>
  );
}

interface LinkModelEditorProps {
  initial: string;
  onCommit: (text: string) => void;
}

/** Model text is edited locally and written to the project when the field loses focus. */
function LinkModelEditor({ initial, onCommit }: LinkModelEditorProps) {
  const [model, setModel] = useState(initial);
  return (
    <textarea
      className="link-properties__model"
      aria-label="Модель связи"
      placeholder="GPSS операторы, выполняемые транзактом при переходе по связи"
      value={model}
      onChange={(event) => setModel(event.target.value)}
      onBlur={() => onCommit(model)}
    />
  );
}
