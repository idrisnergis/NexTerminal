import { useState, useCallback, useEffect } from 'react';
import { X, Terminal as TerminalIcon, FolderOpen, Home, Search, MonitorDot } from 'lucide-react';
import { TerminalTab } from '../types/electron';
import TerminalView from './TerminalView';
import FileBrowser from './FileBrowser';
import ResizeHandle from './ResizeHandle';
import ServerStatusBar from './ServerStatusBar';

interface TerminalPanelProps {
  tabs: TerminalTab[];
  activeTabId: string | null;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
  onReconnect?: (tab: TerminalTab) => void;
  onQuickConnect?: (searchTerm: string) => void;
  onStartLocalTerminal?: () => void;
}

function TerminalPanel({ tabs, activeTabId, onTabSelect, onTabClose, onReconnect, onQuickConnect, onStartLocalTerminal }: TerminalPanelProps) {
  const [fileBrowserVisible, setFileBrowserVisible] = useState<Record<string, boolean>>({});
  const [fileBrowserWidth, setFileBrowserWidth] = useState(280);
  const [showHome, setShowHome] = useState(true);
  const [quickSearch, setQuickSearch] = useState('');

  // When a new tab becomes active from outside (new connection), switch away from home
  useEffect(() => {
    if (activeTabId && tabs.find(t => t.id === activeTabId)) {
      setShowHome(false);
    }
  }, [activeTabId, tabs]);

  const toggleFileBrowser = (tabId: string) => {
    setFileBrowserVisible((prev) => ({
      ...prev,
      [tabId]: !prev[tabId],
    }));
  };

  const handleFileBrowserResize = useCallback((delta: number) => {
    setFileBrowserWidth((w) => Math.max(180, Math.min(500, w - delta)));
  }, []);

  // Show home when no tabs or home is explicitly selected
  const isHomeActive = showHome || !activeTabId;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab Bar */}
      <div className="flex items-center bg-sidebar-bg border-b border-border overflow-x-auto">
        {/* Home Tab */}
        <div
          className={`tab-item ${isHomeActive || tabs.length === 0 ? 'active' : ''}`}
          onClick={() => { setShowHome(true); onTabSelect(''); }}
          role="tab"
        >
          <Home size={12} />
          <span className="text-xs">Home</span>
        </div>

        {/* Session Tabs */}
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab-item ${tab.id === activeTabId && !showHome ? 'active' : ''}`}
            onClick={() => { setShowHome(false); onTabSelect(tab.id); }}
            role="tab"
            aria-selected={tab.id === activeTabId}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                tab.isConnected ? 'bg-success' : 'bg-error'
              }`}
            />
            <span className="truncate max-w-[100px] text-[11px]">{tab.connectionName}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
              className="ml-1 p-0.5 rounded hover:bg-error/20 text-terminal-fg/50 hover:text-error transition-colors"
              aria-label={`Close ${tab.connectionName}`}
            >
              <X size={10} />
            </button>
          </div>
        ))}

        {/* File Browser Toggle */}
        <div className="ml-auto flex items-center pr-2">
          {activeTabId && !showHome && (
            <button
              onClick={() => toggleFileBrowser(activeTabId)}
              className={`p-1.5 rounded transition-colors ${
                fileBrowserVisible[activeTabId] ? 'bg-accent/10 text-accent' : 'hover:bg-sidebar-hover text-terminal-fg/50'
              }`}
              title="Toggle file browser"
            >
              <FolderOpen size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Home Screen */}
        {(isHomeActive || tabs.length === 0) && (
          <div className="flex-1 flex flex-col items-center justify-center text-terminal-fg/30">
            <TerminalIcon size={48} className="mb-3 text-accent/40" />
            <h2 className="text-lg font-semibold mb-1 text-terminal-fg/60">NexTerm</h2>
            <p className="text-xs mb-6 text-terminal-fg/30">SSH Connection Manager</p>

            {/* Action buttons */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={onStartLocalTerminal}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border hover:border-accent/50 hover:bg-accent/5 transition-all"
              >
                <MonitorDot size={14} className="text-success" />
                <span className="text-xs text-terminal-fg/70">Start local terminal</span>
              </button>
            </div>

            {/* Quick search */}
            <div className="w-72 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-terminal-fg/30" />
              <input
                type="text"
                className="input-field pl-9 text-sm"
                placeholder="Find session or server name..."
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && quickSearch.trim()) {
                    onQuickConnect?.(quickSearch.trim());
                    setQuickSearch('');
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* Terminal Views */}
        {!isHomeActive && tabs.length > 0 && (
          <>
            <div className="flex-1 flex flex-col">
              <div className="flex-1 flex overflow-hidden">
                {/* Terminal */}
                <div className="flex-1 relative">
                  {tabs.map((tab) => (
                    <div
                      key={tab.id}
                      className={`absolute inset-0 ${tab.id === activeTabId && !showHome ? '' : 'hidden'}`}
                    >
                      <TerminalView
                        sessionId={tab.sessionId}
                        isActive={tab.id === activeTabId && !showHome}
                        onReconnect={() => onReconnect?.(tab)}
                        onCloseTab={() => onTabClose(tab.id)}
                      />
                    </div>
                  ))}
                </div>

                {/* File Browser */}
                {activeTabId && (fileBrowserVisible[activeTabId] ?? false) && (
                  <>
                    <ResizeHandle direction="horizontal" onResize={handleFileBrowserResize} />
                    <div style={{ width: fileBrowserWidth, minWidth: fileBrowserWidth }}>
                      <FileBrowser
                        sessionId={activeTabId}
                        isVisible={true}
                        onToggle={() => toggleFileBrowser(activeTabId)}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Server Status Bar */}
              {activeTabId && tabs.find(t => t.id === activeTabId) && (
                <ServerStatusBar
                  sessionId={activeTabId}
                  isConnected={tabs.find(t => t.id === activeTabId)?.isConnected ?? false}
                  connectionName={tabs.find(t => t.id === activeTabId)?.connectionName ?? ''}
                  host={tabs.find(t => t.id === activeTabId)?.host ?? ''}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default TerminalPanel;
