import { useCallback, useEffect, useRef, useState } from 'react';

interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
}

function ResizeHandle({ direction, onResize }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startPosRef.current = direction === 'horizontal' ? e.clientX : e.clientY;
  }, [direction]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
      const delta = currentPos - startPosRef.current;
      startPosRef.current = currentPos;
      onResize(delta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, direction, onResize]);

  if (direction === 'horizontal') {
    return (
      <div
        className={`w-1 cursor-col-resize flex items-center justify-center group hover:bg-accent/30 transition-colors ${
          isDragging ? 'bg-accent/40' : ''
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className={`w-0.5 h-8 rounded-full ${isDragging ? 'bg-accent' : 'bg-border group-hover:bg-accent/60'} transition-colors`} />
      </div>
    );
  }

  return (
    <div
      className={`h-1 cursor-row-resize flex items-center justify-center group hover:bg-accent/30 transition-colors ${
        isDragging ? 'bg-accent/40' : ''
      }`}
      onMouseDown={handleMouseDown}
    >
      <div className={`h-0.5 w-8 rounded-full ${isDragging ? 'bg-accent' : 'bg-border group-hover:bg-accent/60'} transition-colors`} />
    </div>
  );
}

export default ResizeHandle;
