import { useState } from 'react';
import { X, Lock, Key, User, FolderOpen } from 'lucide-react';
import { SavedConnection } from '../types/electron';

interface QuickAuthDialogProps {
  connection: SavedConnection;
  errorMessage?: string;
  onConnect: (connection: SavedConnection) => void;
  onClose: () => void;
}

function QuickAuthDialog({ connection, errorMessage, onConnect, onClose }: QuickAuthDialogProps) {
  const [username, setUsername] = useState(connection.username || '');
  const [password, setPassword] = useState(connection.password || '');
  const [authType, setAuthType] = useState<'password' | 'key'>(connection.authType || 'password');
  const [keyPath, setKeyPath] = useState(connection.privateKeyPath || '');
  const [passphrase, setPassphrase] = useState(connection.passphrase || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setLoading(true);
    const updated: SavedConnection = {
      ...connection,
      username: username.trim(),
      authType,
      password: authType === 'password' ? password : undefined,
      privateKeyPath: authType === 'key' ? keyPath : undefined,
      passphrase: authType === 'key' ? passphrase : undefined,
    };
    onConnect(updated);
    setTimeout(() => setLoading(false), 1000);
  };

  const handleBrowseKey = async () => {
    const result = await window.electronAPI.openFileDialog({
      title: 'Select SSH Key',
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'PEM/PPK Files', extensions: ['pem', 'ppk', 'key'] },
      ],
    });
    if (result.success && result.path) {
      setKeyPath(result.path);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-surface w-[440px] rounded-xl shadow-2xl border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold">Login to Server</h2>
            <p className="text-xs text-terminal-fg/50 mt-0.5">
              {connection.host}:{connection.port}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-light">
            <X size={16} />
          </button>
        </div>

        {/* Error */}
        {errorMessage && (
          <div className="mx-5 mt-3 px-3 py-2 text-xs text-error bg-error/10 rounded-lg border border-error/20">
            {errorMessage}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {/* Username */}
          <div>
            <label className="block text-xs text-terminal-fg/70 mb-1">Username</label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-terminal-fg/40" />
              <input
                type="text"
                className="input-field text-sm pl-9"
                placeholder="root, webuser, admin..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {/* Auth type toggle */}
          <div>
            <label className="block text-xs text-terminal-fg/70 mb-1">Authentication</label>
            <div className="flex gap-2">
              <button
                type="button"
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all ${
                  authType === 'password' ? 'border-accent bg-accent/10 text-accent' : 'border-border hover:border-border/80'
                }`}
                onClick={() => setAuthType('password')}
              >
                <Lock size={12} />
                Password
              </button>
              <button
                type="button"
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all ${
                  authType === 'key' ? 'border-accent bg-accent/10 text-accent' : 'border-border hover:border-border/80'
                }`}
                onClick={() => setAuthType('key')}
              >
                <Key size={12} />
                SSH Key
              </button>
            </div>
          </div>

          {/* Password */}
          {authType === 'password' && (
            <div>
              <label className="block text-xs text-terminal-fg/70 mb-1">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-terminal-fg/40" />
                <input
                  type="password"
                  className="input-field text-sm pl-9"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* SSH Key */}
          {authType === 'key' && (
            <>
              <div>
                <label className="block text-xs text-terminal-fg/70 mb-1">Private Key</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input-field text-sm flex-1"
                    placeholder="Path to SSH key (.pem, .ppk)"
                    value={keyPath}
                    onChange={(e) => setKeyPath(e.target.value)}
                  />
                  <button type="button" onClick={handleBrowseKey} className="btn-secondary px-2.5">
                    <FolderOpen size={14} />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-terminal-fg/70 mb-1">Passphrase (optional)</label>
                <input
                  type="password"
                  className="input-field text-sm"
                  placeholder="Key passphrase"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary text-xs"
              disabled={!username.trim() || loading}
            >
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default QuickAuthDialog;
