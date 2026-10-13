import { forwardRef, useImperativeHandle, useMemo, useRef, type KeyboardEvent } from 'react';
import { findDefinition, lineRange, tokenizeLine, wordAt } from '../../model/gpssSyntax';
import './GpssCodeEditor.css';

export interface GpssCodeEditorHandle {
  /** Selects a 1-based line and scrolls it into view. */
  revealLine: (line: number) => void;
}

interface GpssCodeEditorProps {
  value: string;
  fontSize: number;
  label: string;
  placeholder?: string;
  /** 1-based lines with translation errors. */
  errorLines?: ReadonlySet<number>;
  onChange: (value: string) => void;
  /** Called when "go to definition" (F12) cannot find the name under the caret. */
  onDefinitionMissing?: (name: string) => void;
}

const LINE_HEIGHT = 1.5;

/**
 * Text editor for GPSS models: a transparent textarea over a highlighted copy of the text, with line
 * numbers, error lines and F12 "Перейти к определению".
 */
export const GpssCodeEditor = forwardRef<GpssCodeEditorHandle, GpssCodeEditorProps>(function GpssCodeEditor(
  { value, fontSize, label, placeholder, errorLines, onChange, onDefinitionMissing },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightRef = useRef<HTMLPreElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const lines = useMemo(() => value.split('\n'), [value]);

  function revealLine(line: number) {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const [start, end] = lineRange(value, line);
    textarea.focus();
    textarea.setSelectionRange(start, end);
    textarea.scrollTop = Math.max(0, (line - 3) * fontSize * LINE_HEIGHT);
    syncScroll();
  }

  useImperativeHandle(ref, () => ({ revealLine }));

  function syncScroll() {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    if (highlightRef.current) {
      highlightRef.current.scrollTop = textarea.scrollTop;
      highlightRef.current.scrollLeft = textarea.scrollLeft;
    }

    if (gutterRef.current) {
      gutterRef.current.scrollTop = textarea.scrollTop;
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'F12') {
      event.preventDefault();
      const name = wordAt(value, event.currentTarget.selectionStart);
      const line = name ? findDefinition(value, name) : null;
      if (line) {
        revealLine(line);
      } else if (name) {
        onDefinitionMissing?.(name);
      }

      return;
    }

    if (event.key === 'Tab') {
      // Tab inserts a tabulation (operands are traditionally aligned with tabs).
      event.preventDefault();
      const target = event.currentTarget;
      const { selectionStart, selectionEnd } = target;
      const next = `${value.slice(0, selectionStart)}\t${value.slice(selectionEnd)}`;
      onChange(next);
      window.requestAnimationFrame(() => target.setSelectionRange(selectionStart + 1, selectionStart + 1));
    }
  }

  const style = { fontSize: `${fontSize}px`, lineHeight: LINE_HEIGHT };

  return (
    <div className="gpss-code-editor">
      <div className="gpss-code-editor__gutter" ref={gutterRef} style={style} aria-hidden="true">
        {lines.map((_, index) => (
          <div key={index} className={errorLines?.has(index + 1) ? 'is-error' : undefined}>
            {index + 1}
          </div>
        ))}
      </div>
      <div className="gpss-code-editor__body">
        <pre className="gpss-code-editor__highlight" ref={highlightRef} style={style} aria-hidden="true">
          {lines.map((line, index) => (
            <div key={index} className={errorLines?.has(index + 1) ? 'gpss-line is-error' : 'gpss-line'}>
              {tokenizeLine(line).map((token, tokenIndex) => (
                <span key={tokenIndex} className={`gpss-token gpss-token--${token.kind}`}>
                  {token.text}
                </span>
              ))}
              {line.length === 0 ? ' ' : null}
            </div>
          ))}
        </pre>
        <textarea
          ref={textareaRef}
          className="gpss-code-editor__input"
          aria-label={label}
          spellCheck={false}
          wrap="off"
          style={style}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onScroll={syncScroll}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  );
});
