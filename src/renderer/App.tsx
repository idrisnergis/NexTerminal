import { useState, useCallback } from 'react';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import TerminalPanel from './components/TerminalPanel';
import ConnectionDialog from './components/ConnectionDialog';
import SettingsDialog from './components/SettingsDialog';
import QuickAuthDialog from './components/QuickAuthDialog';
import ResizeHandle from './components/ResizeHandle';
import { SavedConnection, TerminalTab } from './types/electron';

function App() {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingConnection, setEditingConnection] = useState<SavedConnection | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [refreshKey, setRefreshKey] = useState(0);

  // Quick auth dialog state
  const [quickAuthConnection, setQuickAuthConnection] = useState<SavedConnection | null>(null);
  const [quickAuthError, setQuickAuthError] = useState<string | undefined>(undefined);

  const refreshSidebar = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth((w) => Math.max(200, Math.min(500, w + delta)));
  }, []);

  // Core connect function — tries to connect and returns success/error
  const tryConnect = useCallback(async (connection: SavedConnection): Promise<{ success: boolean; sessionId?: string; error?: string }> => {
    return await window.electronAPI.sshConnect(connection);
  }, []);

  // After successful connection
  const onConnected = useCallback(async (connection: SavedConnection, sessionId: string) => {
    const newTab: TerminalTab = {
      id: sessionId,
      sessionId,
      connectionName: connection.name,
      host: connection.host,
      isConnected: true,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(sessionId);

    // Save credentials so next time it connects without asking
    await window.electronAPI.saveConnection({
      ...connection,
      lastConnected: new Date().toISOString(),
    });
    refreshSidebar();
  }, [refreshSidebar]);

  /**
   * Connect flow:
   * 1. Username var → direkt bağlan (key/keyboard-interactive ile)
   *    - Sunucu password sorarsa terminalde gösterir
   * 2. Username yok → QuickAuth dialog aç, username sor
   * 3. Bağlantı başarılı → kaydedilir
   * 4. Bağlantı hata → QuickAuth dialog'da göster
   */
  const handleConnect = useCallback(async (connection: SavedConnection) => {
    setShowConnectionDialog(false);
    setEditingConnection(null);

    const hasUsername = connection.username && connection.username.trim().length > 0;

    if (!hasUsername) {
      // No username — ask for it
      setQuickAuthConnection(connection);
      setQuickAuthError(undefined);
      return;
    }

    // Has username — try to connect
    const result = await tryConnect(connection);

    if (result.success && result.sessionId) {
      await onConnected(connection, result.sessionId);
    } else {
      // Failed — show login dialog
      setQuickAuthConnection(connection);
      setQuickAuthError(result.error || 'Connection failed');
    }
  }, [tryConnect, onConnected]);

  // Handle connect from QuickAuth dialog
  const handleQuickAuthConnect = useCallback(async (connection: SavedConnection) => {
    const result = await tryConnect(connection);

    if (result.success && result.sessionId) {
      await onConnected(connection, result.sessionId);
      setQuickAuthConnection(null);
      setQuickAuthError(undefined);
    } else {
      // Stay on dialog, show error
      setQuickAuthError(result.error || 'Authentication failed. Try different credentials.');
    }
  }, [tryConnect, onConnected]);

  const handleDisconnect = useCallback(async (tabId: string) => {
    await window.electronAPI.sshDisconnect(tabId);
    setTabs((prev) => {
      const remaining = prev.filter((t) => t.id !== tabId);
      setActiveTabId((currentActive) => {
        if (currentActive === tabId) {
          return remaining.length > 0 ? remaining[remaining.length - 1].id : null;
        }
        return currentActive;
      });
      return remaining;
    });
  }, []);

  const handleCloseTab = useCallback((tabId: string) => {
    handleDisconnect(tabId);
  }, [handleDisconnect]);

  const handleNewConnection = useCallback(() => {
    setEditingConnection(null);
    setShowConnectionDialog(true);
  }, []);

  const handleEditConnection = useCallback((connection: SavedConnection) => {
    setEditingConnection(connection);
    setShowConnectionDialog(true);
  }, []);

  const handleSaveOnly = useCallback(async (connection: SavedConnection) => {
    await window.electronAPI.saveConnection(connection);
    refreshSidebar();
    setShowConnectionDialog(false);
    setEditingConnection(null);
  }, [refreshSidebar]);

  const handleSettingsClose = useCallback(() => {
    setShowSettings(false);
    refreshSidebar();
  }, [refreshSidebar]);

  const handleStartLocalTerminal = useCallback(async () => {
    const result = await window.electronAPI.localStart();
    if (result.success && result.sessionId) {
      const newTab: TerminalTab = {
        id: result.sessionId,
        sessionId: result.sessionId,
        connectionName: 'Local Terminal',
        host: 'localhost',
        isConnected: true,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(result.sessionId);
    }
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-terminal-bg select-none">
      <TitleBar onOpenSettings={() => setShowSettings(true)} />

      <div className="flex flex-1 overflow-hidden">
        {!sidebarCollapsed ? (
          <>
            <div style={{ width: sidebarWidth, minWidth: sidebarWidth }}>
              <Sidebar
                refreshTrigger={refreshKey}
                collapsed={false}
                onToggle={() => setSidebarCollapsed(true)}
                onConnect={handleConnect}
                onNewConnection={handleNewConnection}
                onEditConnection={handleEditConnection}
                onOpenSettings={() => setShowSettings(true)}
              />
            </div>
            <ResizeHandle direction="horizontal" onResize={handleSidebarResize} />
          </>
        ) : (
          <Sidebar
            refreshTrigger={refreshKey}
            collapsed={true}
            onToggle={() => setSidebarCollapsed(false)}
            onConnect={handleConnect}
            onNewConnection={handleNewConnection}
            onEditConnection={handleEditConnection}
            onOpenSettings={() => setShowSettings(true)}
          />
        )}

        <main className="flex-1 flex flex-col overflow-hidden">
          <TerminalPanel
            tabs={tabs}
            activeTabId={activeTabId}
            onTabSelect={(id) => { if (id) setActiveTabId(id); else setActiveTabId(null); }}
            onTabClose={handleCloseTab}
            onReconnect={(tab) => {
              handleCloseTab(tab.id);
            }}
            onStartLocalTerminal={handleStartLocalTerminal}
          />
        </main>
      </div>

      {showConnectionDialog && (
        <ConnectionDialog
          connection={editingConnection}
          onConnect={handleConnect}
          onSave={handleSaveOnly}
          onClose={() => {
            setShowConnectionDialog(false);
            setEditingConnection(null);
          }}
        />
      )}

      {showSettings && (
        <SettingsDialog onClose={handleSettingsClose} />
      )}

      {quickAuthConnection && (
        <QuickAuthDialog
          connection={quickAuthConnection}
          errorMessage={quickAuthError}
          onConnect={handleQuickAuthConnect}
          onClose={() => {
            setQuickAuthConnection(null);
            setQuickAuthError(undefined);
          }}
        />
      )}
    </div>
  );
}

export default App;
