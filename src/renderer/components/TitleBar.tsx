import { Minus, Square, X, Terminal, Settings } from 'lucide-react';

interface TitleBarProps {
  onOpenSettings: () => void;
}

function TitleBar({ onOpenSettings }: TitleBarProps) {
  return (
    <div className="h-8 bg-sidebar-bg flex items-center justify-between select-none draggable border-b border-border/50">
      {/* App Icon & Title */}
      <div className="flex items-center gap-2 px-3 no-drag">
        <Terminal size={16} className="text-accent" />
        <span className="text-xs font-semibold text-terminal-fg/80">NexTerm</span>
      </div>

      {/* Right side: Settings + Window Controls */}
      <div className="flex no-drag">
        <button
          onClick={onOpenSettings}
          className="titlebar-button"
          aria-label="Settings"
          title="Settings"
        >
          <Settings size={13} />
        </button>
        <div className="w-px h-4 bg-border/50 self-center" />
        <button
          onClick={() => window.electronAPI.minimize()}
          className="titlebar-button"
          aria-label="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => window.electronAPI.maximize()}
          className="titlebar-button"
          aria-label="Maximize"
        >
          <Square size={11} />
        </button>
        <button
          onClick={() => window.electronAPI.close()}
          className="titlebar-button close"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

export default TitleBar;
