import { useState, useEffect } from 'react';
import { X, Settings, Key, FolderOpen, User, Globe, Download, FileUp } from 'lucide-react';
import { AppSettings } from '../types/electron';

interface SettingsDialogProps {
  onClose: () => void;
}

function SettingsDialog({ onClose }: SettingsDialogProps) {
  const [settings, setSettings] = useState<AppSettings>({
    defaultSSHKeyPath: '',
    defaultSSHKeyPassphrase: '',
    defaultUsername: '',
    defaultPort: 22,
    useDefaultKeyForAll: false,
    sidebarFontSize: 11,
    terminalFontSize: 14,
  });
  const [saved, setSaved] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const s = await window.electronAPI.getSettings();
    setSettings(s);
  };

  const handleSave = async () => {
    await window.electronAPI.updateSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleBrowseKey = async () => {
    const result = await window.electronAPI.openFileDialog({
      title: 'Select Default SSH Private Key',
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'PEM Files', extensions: ['pem'] },
        { name: 'Key Files', extensions: ['key', 'ppk'] },
      ],
    });
    if (result.success && result.path) {
      setSettings({ ...settings, defaultSSHKeyPath: result.path });
    }
  };

  const handleImportSessions = async () => {
    setImportStatus(null);
    const result = await window.electronAPI.importSessions();
    if (result.success) {
      setImportStatus(`✓ ${result.count} connection(s) imported successfully!`);
    } else if (result.error) {
      setImportStatus(`✗ Import failed: ${result.error}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-surface w-[560px] max-h-[85vh] rounded-xl shadow-2xl border border-border overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <Settings size={20} className="text-accent" />
            <h2 className="text-lg font-semibold">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-light transition-colors"
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Default SSH Key Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-accent">
              <Key size={16} />
              <span>Default SSH Key</span>
            </div>

            <div className="pl-6 space-y-3">
              <div>
                <label className="block text-xs font-medium text-terminal-fg/70 mb-1.5">
                  Private Key Path
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input-field flex-1"
                    placeholder="~/.ssh/id_rsa"
                    value={settings.defaultSSHKeyPath}
                    onChange={(e) => setSettings({ ...settings, defaultSSHKeyPath: e.target.value })}
                  />
                  <button
                    type="button"
                    className="btn-secondary px-3"
                    onClick={handleBrowseKey}
                    aria-label="Browse for key"
                  >
                    <FolderOpen size={16} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-terminal-fg/70 mb-1.5">
                  Passphrase (optional)
                </label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Enter passphrase if key is encrypted"
                  value={settings.defaultSSHKeyPassphrase}
                  onChange={(e) => setSettings({ ...settings, defaultSSHKeyPassphrase: e.target.value })}
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.useDefaultKeyForAll}
                  onChange={(e) => setSettings({ ...settings, useDefaultKeyForAll: e.target.checked })}
                  className="rounded border-border bg-terminal-bg text-accent focus:ring-accent"
                />
                <span className="text-sm text-terminal-fg/70">
                  Use this key for all connections (unless overridden)
                </span>
              </label>
            </div>
          </div>

          {/* Default Connection Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-accent">
              <Globe size={16} />
              <span>Default Connection Settings</span>
            </div>

            <div className="pl-6 space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-terminal-fg/70 mb-1.5">
                    Default Username
                  </label>
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-terminal-fg/40" />
                    <input
                      type="text"
                      className="input-field flex-1"
                      placeholder="root"
                      value={settings.defaultUsername}
                      onChange={(e) => setSettings({ ...settings, defaultUsername: e.target.value })}
                    />
                  </div>
                </div>
                <div className="w-28">
                  <label className="block text-xs font-medium text-terminal-fg/70 mb-1.5">
                    Default Port
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    value={settings.defaultPort}
                    onChange={(e) => setSettings({ ...settings, defaultPort: parseInt(e.target.value) || 22 })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Appearance Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-accent">
              <span className="text-base">Aa</span>
              <span>Appearance</span>
            </div>

            <div className="pl-6 space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-terminal-fg/70 mb-1.5">
                    Sidebar Font Size
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="9"
                      max="14"
                      value={settings.sidebarFontSize}
                      onChange={(e) => setSettings({ ...settings, sidebarFontSize: parseInt(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="text-xs text-terminal-fg/50 w-8">{settings.sidebarFontSize}px</span>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-terminal-fg/70 mb-1.5">
                    Terminal Font Size
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="10"
                      max="20"
                      value={settings.terminalFontSize}
                      onChange={(e) => setSettings({ ...settings, terminalFontSize: parseInt(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="text-xs text-terminal-fg/50 w-8">{settings.terminalFontSize}px</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Import Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-accent">
              <Download size={16} />
              <span>Import Connections</span>
            </div>

            <div className="pl-6 space-y-3">
              <p className="text-xs text-terminal-fg/50">
                Import saved sessions from an .ini or .mxtsessions file.
              </p>

              <button
                onClick={handleImportSessions}
                className="flex items-center gap-3 w-full p-3 rounded-lg border border-border hover:border-accent/50 hover:bg-accent/5 transition-all"
              >
                <div className="p-2 rounded-lg bg-accent/10">
                  <FileUp size={18} className="text-accent" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium">Import Sessions</div>
                  <div className="text-xs text-terminal-fg/50">.ini or .mxtsessions file</div>
                </div>
              </button>

              {importStatus && (
                <div className={`text-xs p-2 rounded-lg ${
                  importStatus.startsWith('✓') ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
                }`}>
                  {importStatus}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-sidebar-bg/50 shrink-0">
          <div className="text-xs text-terminal-fg/40">
            {saved && (
              <span className="text-success font-medium">✓ Settings saved</span>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleSave} className="btn-primary">
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsDialog;
