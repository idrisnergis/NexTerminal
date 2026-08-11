import { useCallback, useEffect, useRef, useState } from 'react';

interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
}

function ResizeHandle({ direction, onResize }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);

  const stopDragging = useCallback((target?: Element) => {
    const pointerId = pointerIdRef.current;
    if (pointerId !== null && target?.hasPointerCapture?.(pointerId)) {
      target.releasePointerCapture(pointerId);
    }
    pointerIdRef.current = null;
    setIsDragging(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    const cancelDrag = () => stopDragging();
    window.addEventListener('blur', cancelDrag);
    window.addEventListener('mouseup', cancelDrag);
    return () => {
      window.removeEventListener('blur', cancelDrag);
      window.removeEventListener('mouseup', cancelDrag);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [stopDragging]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    pointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    startPosRef.current = direction === 'horizontal' ? event.clientX : event.clientY;
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    setIsDragging(true);
  }, [direction]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || event.pointerId !== pointerIdRef.current) return;
    const currentPos = direction === 'horizontal' ? event.clientX : event.clientY;
    const delta = currentPos - startPosRef.current;
    if (delta !== 0) {
      startPosRef.current = currentPos;
      onResize(delta);
    }
  }, [direction, isDragging, onResize]);

  const handlePointerEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerId === pointerIdRef.current) stopDragging(event.currentTarget);
  }, [stopDragging]);

  const horizontal = direction === 'horizontal';

  return (
    <div
      className={`${horizontal ? 'w-1.5 cursor-col-resize' : 'h-1.5 cursor-row-resize'} relative z-30 shrink-0 flex items-center justify-center group hover:bg-accent/30 transition-colors select-none no-drag pointer-events-auto ${isDragging ? 'bg-accent/40' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={() => stopDragging()}
    >
      <div className={`${horizontal ? 'w-0.5 h-8' : 'h-0.5 w-8'} rounded-full ${isDragging ? 'bg-accent' : 'bg-border group-hover:bg-accent/60'} transition-colors`} />
    </div>
  );
}

export default ResizeHandle;
