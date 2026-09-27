import type { ReportSectionId } from '../../../shared/types/teb';

/** Key of a user-edited standard report cell in `reportCellEdits`. */
export function reportCellKey(sectionId: ReportSectionId, rowIndex: number, columnIndex: number): string {
  return `${sectionId}:${rowIndex}:${columnIndex}`;
}
