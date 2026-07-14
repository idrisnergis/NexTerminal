import { useState, useCallback, useEffect } from 'react';
import { X, FolderOpen, Home } from 'lucide-react';
import { TerminalTab } from '../types/electron';
import TerminalView from './TerminalView';
import FileBrowser from './FileBrowser';
import ResizeHandle from './ResizeHandle';
import ServerStatusBar from './ServerStatusBar';
import HomeScreen from './HomeScreen';

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
          <HomeScreen
            onStartLocalTerminal={onStartLocalTerminal}
            onConnect={onQuickConnect}
          />
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
