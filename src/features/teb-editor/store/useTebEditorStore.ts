import { create } from 'zustand';
import { createDiagnosticsSlice } from './slices/diagnosticsSlice';
import { createExperimentSlice } from './slices/experimentSlice';
import { createFinalReportSlice } from './slices/finalReportSlice';
import { createFormSlice } from './slices/formSlice';
import { createLayoutSlice } from './slices/layoutSlice';
import { createPersistenceSlice } from './slices/persistenceSlice';
import { createProjectSlice } from './slices/projectSlice';
import { createResultSlice } from './slices/resultSlice';
import { createSchemeSlice } from './slices/schemeSlice';
import { createSimulationSlice } from './slices/simulationSlice';
import { createTebSlice } from './slices/tebSlice';
import { createTebTestSlice } from './slices/tebTestSlice';
import type { TebEditorStore } from './types';

export type { TebEditorStore } from './types';

/**
 * Single application store composed from feature slices:
 * layout (documents, panels, explorer), TEB document editing, simulation,
 * structural scheme, diagnostics (journal, report, issues, tests), simulation projects, experiments, user forms,
 * saved simulation results, the final report, TEB tests and persistence.
 */
export const useTebEditorStore = create<TebEditorStore>()((...args) => ({
  ...createLayoutSlice(...args),
  ...createTebSlice(...args),
  ...createSimulationSlice(...args),
  ...createSchemeSlice(...args),
  ...createDiagnosticsSlice(...args),
  ...createProjectSlice(...args),
  ...createExperimentSlice(...args),
  ...createFormSlice(...args),
  ...createResultSlice(...args),
  ...createFinalReportSlice(...args),
  ...createTebTestSlice(...args),
  ...createPersistenceSlice(...args),
}));
