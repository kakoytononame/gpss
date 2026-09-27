import { useEffect, type RefObject } from 'react';

/**
 * Calls `onDismiss` when the user presses the mouse outside `ref` or presses Escape.
 */
export function useDismissOnOutsideClick(ref: RefObject<HTMLElement | null>, isOpen: boolean, onDismiss: () => void): void {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        onDismiss();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onDismiss();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [ref, isOpen, onDismiss]);
}
