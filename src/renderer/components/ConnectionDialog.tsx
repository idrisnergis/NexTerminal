import React, { useState, useEffect } from 'react';
import { X, Server, Key, Lock, FolderOpen } from 'lucide-react';
import { SavedConnection } from '../types/electron';

// Get existing groups from connections + localStorage
function getExistingGroups(): string[] {
  const folders: string[] = JSON.parse(localStorage.getItem('sc-folders') || '[]');
  // Also try to get groups from saved connections (async workaround: read from last known)
  const cachedGroups: string[] = JSON.parse(localStorage.getItem('sc-groups-cache') || '[]');
  const all = [...new Set([...folders, ...cachedGroups])].filter(Boolean).sort();
  return all;
}

interface ConnectionDialogProps {
  connection: SavedConnection | null;
  onConnect: (connection: SavedConnection) => void;
  onSave: (connection: SavedConnection) => void;
  onClose: () => void;
}

function ConnectionDialog({ connection, onConnect, onSave, onClose }: ConnectionDialogProps) {
  const [formData, setFormData] = useState<SavedConnection>(getInitialFormData(connection));
  const [useDefaultKey, setUseDefaultKey] = useState(false);
  const [defaultKeyAvailable, setDefaultKeyAvailable] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when connection prop changes
  useEffect(() => {
    setFormData(getInitialFormData(connection));
    setErrors({});
  }, [connection?.id]);

  // Load settings to check if default key is available
  useEffect(() => {
    (async () => {
      const settings = await window.electronAPI.getSettings();
      if (settings.defaultSSHKeyPath) {
        setDefaultKeyAvailable(true);
        // Auto-fill defaults if creating a new connection
        if (!connection) {
          setFormData((prev) => ({
            ...prev,
            username: prev.username || settings.defaultUsername || '',
            port: prev.port === 22 ? (settings.defaultPort || 22) : prev.port,
          }));
          if (settings.useDefaultKeyForAll) {
            setUseDefaultKey(true);
            setFormData((prev) => ({
              ...prev,
              authType: 'key',
              privateKeyPath: settings.defaultSSHKeyPath,
              passphrase: settings.defaultSSHKeyPassphrase,
            }));
          }
        }
      }
    })();
  }, [connection?.id]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.host.trim()) newErrors.host = 'Host is required';
    if (!formData.username.trim()) newErrors.username = 'Username is required';
    if (formData.port < 1 || formData.port > 65535) newErrors.port = 'Invalid port';
    if (formData.authType === 'password' && !formData.password?.trim() && !useDefaultKey) {
      newErrors.password = 'Password is required';
    }
    if (formData.authType === 'key' && !formData.privateKeyPath?.trim()) {
      newErrors.privateKeyPath = 'Private key path is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onConnect(formData);
  };

  const handleSaveOnly = () => {
    if (!formData.name.trim() || !formData.host.trim() || !formData.username.trim()) {
      validate();
      return;
    }
    onSave(formData);
  };

  const handleUseDefaultKey = async (checked: boolean) => {
    setUseDefaultKey(checked);
    if (checked) {
      const settings = await window.electronAPI.getSettings();
      setFormData({
        ...formData,
        authType: 'key',
        privateKeyPath: settings.defaultSSHKeyPath,
        passphrase: settings.defaultSSHKeyPassphrase,
      });
    } else {
      setFormData({
        ...formData,
        authType: 'password',
        privateKeyPath: '',
        passphrase: '',
      });
    }
  };

  const handleBrowseKey = async () => {
    const result = await window.electronAPI.openFileDialog({
      title: 'Select SSH Private Key',
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'PEM Files', extensions: ['pem'] },
        { name: 'Key Files', extensions: ['key', 'ppk'] },
      ],
    });
    if (result.success && result.path) {
      setFormData({ ...formData, privateKeyPath: result.path });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onMouseDown={() => { (document.activeElement as HTMLElement)?.blur(); }}>
      <div className="bg-surface w-[520px] max-h-[90vh] rounded-xl shadow-2xl border border-border overflow-hidden flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Server size={20} className="text-accent" />
            <h2 className="text-lg font-semibold">
              {connection ? 'Edit Connection' : 'New SSH Connection'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-light transition-colors"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Connection Name */}
          <div>
            <label className="block text-xs font-medium text-terminal-fg/70 mb-1.5">
              Connection Name
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="My Server"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              autoFocus
            />
            {errors.name && <p className="text-xs text-error mt-1">{errors.name}</p>}
          </div>

          {/* Host & Port */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-terminal-fg/70 mb-1.5">
                Host / IP
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="192.168.1.100 or server.example.com"
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
              />
              {errors.host && <p className="text-xs text-error mt-1">{errors.host}</p>}
            </div>
            <div className="w-24">
              <label className="block text-xs font-medium text-terminal-fg/70 mb-1.5">
                Port
              </label>
              <input
                type="number"
                className="input-field"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 22 })}
              />
              {errors.port && <p className="text-xs text-error mt-1">{errors.port}</p>}
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-medium text-terminal-fg/70 mb-1.5">
              Username
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="root"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            />
            {errors.username && <p className="text-xs text-error mt-1">{errors.username}</p>}
          </div>

          {/* Use default key checkbox */}
          {defaultKeyAvailable && (
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-accent/5 border border-accent/20">
              <input
                type="checkbox"
                checked={useDefaultKey}
                onChange={(e) => handleUseDefaultKey(e.target.checked)}
                className="rounded border-border bg-terminal-bg text-accent focus:ring-accent"
              />
              <Key size={14} className="text-accent" />
              <span className="text-sm text-terminal-fg/80">Use default SSH key from settings</span>
            </label>
          )}

          {/* Auth Type */}
          {!useDefaultKey && (
            <>
              <div>
                <label className="block text-xs font-medium text-terminal-fg/70 mb-1.5">
                  Authentication
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-all ${
                      formData.authType === 'password'
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border hover:border-border/80'
                    }`}
                    onClick={() => setFormData({ ...formData, authType: 'password' })}
                  >
                    <Lock size={14} />
                    <span className="text-sm">Password</span>
                  </button>
                  <button
                    type="button"
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-all ${
                      formData.authType === 'key'
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border hover:border-border/80'
                    }`}
                    onClick={() => setFormData({ ...formData, authType: 'key' })}
                  >
                    <Key size={14} />
                    <span className="text-sm">SSH Key</span>
                  </button>
                </div>
              </div>

              {/* Password Field */}
              {formData.authType === 'password' && (
                <div>
                  <label className="block text-xs font-medium text-terminal-fg/70 mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    className="input-field"
                    placeholder="Enter password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                  {errors.password && <p className="text-xs text-error mt-1">{errors.password}</p>}
                </div>
              )}

              {/* SSH Key Fields */}
              {formData.authType === 'key' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-terminal-fg/70 mb-1.5">
                      Private Key Path
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="input-field flex-1"
                        placeholder="~/.ssh/id_rsa"
                        value={formData.privateKeyPath}
                        onChange={(e) => setFormData({ ...formData, privateKeyPath: e.target.value })}
                      />
                      <button
                        type="button"
                        className="btn-secondary px-3"
                        aria-label="Browse for key file"
                        onClick={handleBrowseKey}
                      >
                        <FolderOpen size={16} />
                      </button>
                    </div>
                    {errors.privateKeyPath && (
                      <p className="text-xs text-error mt-1">{errors.privateKeyPath}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-terminal-fg/70 mb-1.5">
                      Passphrase (optional)
                    </label>
                    <input
                      type="password"
                      className="input-field"
                      placeholder="Enter passphrase if key is encrypted"
                      value={formData.passphrase}
                      onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {/* Group / Folder */}
          <div>
            <label className="block text-xs font-medium text-terminal-fg/70 mb-1.5">
              Folder
            </label>
            <div className="flex gap-2">
              <select
                className="input-field flex-1"
                value={formData.group || ''}
                onChange={(e) => setFormData({ ...formData, group: e.target.value || undefined })}
              >
                <option value="">No folder (root)</option>
                {getExistingGroups().map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <input
                type="text"
                className="input-field w-32"
                placeholder="Or new..."
                onChange={(e) => {
                  if (e.target.value.trim()) {
                    setFormData({ ...formData, group: e.target.value.trim() });
                  }
                }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-2">
            <button type="button" onClick={handleSaveOnly} className="btn-secondary">
              Save Only
            </button>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Save & Connect
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function getInitialFormData(connection: SavedConnection | null): SavedConnection {
  return {
    id: connection?.id || generateId(),
    name: connection?.name || '',
    host: connection?.host || '',
    port: connection?.port || 22,
    username: connection?.username || '',
    authType: connection?.authType || 'password',
    password: connection?.password || '',
    privateKeyPath: connection?.privateKeyPath || '',
    passphrase: connection?.passphrase || '',
    group: connection?.group || '',
  };
}

export default ConnectionDialog;
