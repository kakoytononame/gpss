/** Key of a user-edited standard report cell in `reportCellEdits`. */
export function reportCellKey(sectionId: string, rowIndex: number, columnIndex: number): string {
  return `${sectionId}:${rowIndex}:${columnIndex}`;
}
