import { useState, useEffect } from 'react';

function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter');

  useEffect(() => {
    const enterTimer = setTimeout(() => setPhase('hold'), 600);
    const holdTimer = setTimeout(() => setPhase('exit'), 2000);
    const exitTimer = setTimeout(() => onFinish(), 2600);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(holdTimer);
      clearTimeout(exitTimer);
    };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-[#0f0f1a] transition-opacity duration-500 ${
        phase === 'exit' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Background glow effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-accent/10 rounded-full blur-[60px]" />
      </div>

      {/* Logo & Content */}
      <div
        className={`relative flex flex-col items-center transition-all duration-700 ${
          phase === 'enter' ? 'opacity-0 scale-90 translate-y-4' : 'opacity-100 scale-100 translate-y-0'
        }`}
      >
        {/* Icon */}
        <div className="relative mb-6">
          {/* Outer ring animation */}
          <div className="absolute inset-0 w-24 h-24 -m-2">
            <svg viewBox="0 0 100 100" className="w-full h-full animate-spin-slow">
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="url(#gradient-ring)"
                strokeWidth="1.5"
                strokeDasharray="20 10 5 10"
                strokeLinecap="round"
                opacity="0.6"
              />
              <defs>
                <linearGradient id="gradient-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7aa2f7" />
                  <stop offset="50%" stopColor="#9ece6a" />
                  <stop offset="100%" stopColor="#7aa2f7" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Main icon */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/30 flex items-center justify-center backdrop-blur-sm shadow-lg shadow-accent/10">
            <svg
              viewBox="0 0 48 48"
              className="w-10 h-10"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Terminal prompt */}
              <path
                d="M8 34L18 24L8 14"
                stroke="#7aa2f7"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-draw"
              />
              {/* Cursor line */}
              <path
                d="M22 34H40"
                stroke="#9ece6a"
                strokeWidth="3"
                strokeLinecap="round"
                className="animate-blink"
              />
              {/* Network dots */}
              <circle cx="36" cy="14" r="2.5" fill="#7aa2f7" opacity="0.8" />
              <circle cx="42" cy="14" r="1.5" fill="#9ece6a" opacity="0.6" />
              <circle cx="42" cy="20" r="1.5" fill="#e0af68" opacity="0.6" />
              {/* Connection lines */}
              <path
                d="M36 14L39 14M36 14L39 20"
                stroke="#7aa2f7"
                strokeWidth="1"
                strokeLinecap="round"
                opacity="0.4"
              />
            </svg>
          </div>
        </div>

        {/* App name */}
        <h1 className="text-2xl font-bold tracking-wide">
          <span className="text-accent">Nex</span>
          <span className="text-terminal-fg">Term</span>
        </h1>

        {/* Subtitle */}
        <p className="text-xs text-terminal-fg/40 mt-2 tracking-widest uppercase">
          SSH Terminal Manager
        </p>

        {/* Loading indicator */}
        <div className="mt-8 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

export default SplashScreen;
