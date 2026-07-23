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
  // and auto-open file browser for remote connections
  useEffect(() => {
    if (activeTabId && tabs.find(t => t.id === activeTabId)) {
      setShowHome(false);

      const tab = tabs.find(t => t.id === activeTabId);
      if (tab && tab.isConnected && tab.connectionName !== 'Local Terminal') {
        setFileBrowserVisible((prev) => {
          if (prev[activeTabId] === undefined) {
            return { ...prev, [activeTabId]: true };
          }
          return prev;
        });
      }
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

  const isHomeActive = showHome || !activeTabId;
  const activeTab = activeTabId ? tabs.find(t => t.id === activeTabId) : null;

  // Determine if file browser should show for the current active tab
  const showFileBrowserForActive = !!(
    activeTabId &&
    !isHomeActive &&
    activeTab &&
    activeTab.connectionName !== 'Local Terminal' &&
    (fileBrowserVisible[activeTabId] ?? false)
  );

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
          {activeTabId && !isHomeActive && activeTab && activeTab.connectionName !== 'Local Terminal' && (
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

      {/* Content Area — all views stay mounted, visibility controlled via CSS */}
      <div className="flex-1 relative overflow-hidden">
        {/* Home Screen */}
        <div className={`absolute inset-0 z-20 ${isHomeActive || tabs.length === 0 ? '' : 'pointer-events-none hidden'}`}>
          <HomeScreen
            onStartLocalTerminal={onStartLocalTerminal}
            onConnect={onQuickConnect}
          />
        </div>

        {/* Terminal + File Browser area — always rendered once tabs exist */}
        {tabs.length > 0 && (
          <div className={`absolute inset-0 flex flex-col ${isHomeActive ? 'invisible pointer-events-none' : ''}`}>
            <div className="flex-1 flex overflow-hidden">
              {/* Terminals — all stay mounted, only active one visible */}
              <div className="flex-1 relative">
                {tabs.map((tab) => (
                  <div
                    key={tab.id}
                    className={`absolute inset-0 ${tab.id === activeTabId && !isHomeActive ? '' : 'hidden'}`}
                  >
                    <TerminalView
                      sessionId={tab.sessionId}
                      isActive={tab.id === activeTabId && !isHomeActive}
                      onReconnect={() => onReconnect?.(tab)}
                      onCloseTab={() => onTabClose(tab.id)}
                    />
                  </div>
                ))}
              </div>

              {/* File Browsers — each tab keeps its own instance alive */}
              {showFileBrowserForActive && activeTabId && (
                <ResizeHandle direction="horizontal" onResize={handleFileBrowserResize} />
              )}
              {tabs
                .filter(t => t.connectionName !== 'Local Terminal' && fileBrowserVisible[t.id])
                .map((tab) => (
                  <div
                    key={`fb-${tab.id}`}
                    className={tab.id === activeTabId && !isHomeActive ? '' : 'hidden'}
                    style={{ width: fileBrowserWidth, minWidth: fileBrowserWidth }}
                  >
                    <FileBrowser
                      sessionId={tab.sessionId}
                      isVisible={tab.id === activeTabId && !isHomeActive}
                      onToggle={() => toggleFileBrowser(tab.id)}
                    />
                  </div>
                ))}
            </div>

            {/* Server Status Bar */}
            {activeTab && !isHomeActive && (
              <ServerStatusBar
                sessionId={activeTab.sessionId}
                isConnected={activeTab.isConnected}
                connectionName={activeTab.connectionName}
                host={activeTab.host}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TerminalPanel;
