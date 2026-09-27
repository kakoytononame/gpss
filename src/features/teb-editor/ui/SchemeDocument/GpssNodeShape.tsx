import type { ReactNode, SVGProps } from 'react';

interface GpssNodeShapeProps {
  shape: string;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
}

type ShapeStyle = Pick<SVGProps<SVGElement>, 'fill' | 'stroke' | 'strokeWidth' | 'vectorEffect'>;

interface ShapeStyles {
  filled: ShapeStyle;
  outline: ShapeStyle;
}

const DEFAULT_BODY = (styles: ShapeStyles) => <rect x="5" y="8" width="150" height="60" rx="2" {...styles.filled} />;

const DIAMOND_BODY = (styles: ShapeStyles) => <path d="M 80 5 L 155 38 L 80 71 L 5 38 Z" {...styles.filled} />;

const LINK_BODY = (styles: ShapeStyles) => <rect x="12" y="8" width="136" height="60" rx="20" {...styles.filled} />;

/** Outline of a GPSS block symbol, in a 160×76 view box (see GPSS World block diagrams). */
const BODIES: Record<string, (styles: ShapeStyles) => ReactNode> = {
  diamond: DIAMOND_BODY,
  test: DIAMOND_BODY,
  generate: (styles) => <path d="M 42 7 A 31 31 0 1 0 42 69 H 139 V 53 H 155 V 69 H 42" {...styles.filled} />,
  terminate: (styles) => <ellipse cx="80" cy="38" rx="73" ry="32" {...styles.filled} />,
  loop: (styles) => <path d="M 30 7 H 155 V 69 H 30 L 5 38 Z" {...styles.filled} />,
  link: LINK_BODY,
  unlink: LINK_BODY,
  select: (styles) => <path d="M 23 8 H 130 L 155 38 L 130 68 H 23 Z" {...styles.filled} />,
  mark: (styles) => <rect x="7" y="8" width="146" height="60" rx="18" {...styles.filled} />,
};

const ASSIGN_MARK = (styles: ShapeStyles) => <rect x="58" y="1" width="44" height="16" {...styles.filled} />;
const DOUBLE_BOTTOM_LINE = (styles: ShapeStyles) => <path d="M 5 59 H 155 M 5 65 H 155" {...styles.outline} />;
const QUEUE_MARK = (styles: ShapeStyles) => <circle cx="151" cy="16" r="10" {...styles.filled} />;
const STORAGE_MARK = (styles: ShapeStyles) => <path d="M 139 68 V 53 H 155 V 68" {...styles.outline} />;
const RELEASE_MARK = (styles: ShapeStyles) => <path d="M 130 8 L 145 23 L 155 8" {...styles.outline} />;
const SEIZE_MARK = (styles: ShapeStyles) => <path d="M 128 68 L 143 48 L 158 68 Z" {...styles.filled} />;

/** Extra strokes that distinguish blocks sharing the same outline. */
const DECORATIONS: Record<string, (styles: ShapeStyles) => ReactNode> = {
  test: (styles) => <path d="M 36 38 H 124" {...styles.outline} />,
  link: (styles) => <rect x="136" y="18" width="19" height="40" rx="9" {...styles.filled} />,
  unlink: (styles) => <rect x="5" y="10" width="23" height="56" rx="11" {...styles.filled} />,
  select: (styles) => <circle cx="11" cy="38" r="10" {...styles.filled} />,
  assemble: (styles) => <path d="M 6 9 L 80 42 L 154 9" {...styles.outline} />,
  gather: (styles) => <path d="M 6 9 L 154 67 M 154 9 L 6 67" {...styles.outline} />,
  assign: ASSIGN_MARK,
  priority: ASSIGN_MARK,
  buffer: DOUBLE_BOTTOM_LINE,
  savevalue: DOUBLE_BOTTOM_LINE,
  depart: QUEUE_MARK,
  queue: QUEUE_MARK,
  enter: STORAGE_MARK,
  tabulate: STORAGE_MARK,
  leave: RELEASE_MARK,
  release: RELEASE_MARK,
  return: RELEASE_MARK,
  logic: (styles) => <rect x="145" y="27" width="12" height="22" {...styles.filled} />,
  match: (styles) => <path d="M 155 8 L 132 38 L 155 68" {...styles.outline} />,
  preempt: SEIZE_MARK,
  seize: SEIZE_MARK,
};

export function GpssNodeShape({ shape, backgroundColor, borderColor, borderWidth }: GpssNodeShapeProps) {
  const key = shape.toLowerCase();
  const strokeWidth = Math.max(1, borderWidth);
  const styles: ShapeStyles = {
    filled: { fill: backgroundColor, stroke: borderColor, strokeWidth, vectorEffect: 'non-scaling-stroke' },
    outline: { fill: 'none', stroke: borderColor, strokeWidth, vectorEffect: 'non-scaling-stroke' },
  };

  return (
    <svg className="scheme-node__shape" viewBox="0 0 160 76" preserveAspectRatio="none" aria-hidden="true">
      {(BODIES[key] ?? DEFAULT_BODY)(styles)}
      {DECORATIONS[key]?.(styles) ?? null}
    </svg>
  );
}
