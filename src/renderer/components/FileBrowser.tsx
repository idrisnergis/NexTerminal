import { useState, useEffect, useCallback } from 'react';
import {
  Folder,
  File,
  ArrowUp,
  RefreshCw,
  Download,
  Upload,
  FolderPlus,
  Trash2,
  Edit,
  Home,
  ChevronRight,
  FileText,
  X,
} from 'lucide-react';
import { RemoteFile } from '../types/electron';

interface FileBrowserProps {
  sessionId: string;
  isVisible: boolean;
  onToggle: () => void;
}

function FileBrowser({ sessionId, isVisible, onToggle }: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState<RemoteFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: RemoteFile } | null>(null);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [newFolderMode, setNewFolderMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const loadFiles = useCallback(async (dirPath: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.sftpList(sessionId, dirPath);
      if (result.success && result.files) {
        setFiles(result.files);
        setCurrentPath(dirPath);
      } else {
        setError(result.error || 'Failed to list directory');
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    if (isVisible && sessionId) {
      loadFiles('/');
    }
  }, [sessionId, isVisible, loadFiles]);

  const navigateTo = (dirName: string) => {
    const newPath = currentPath === '/' ? `/${dirName}` : `${currentPath}/${dirName}`;
    loadFiles(newPath);
  };

  const navigateUp = () => {
    if (currentPath === '/') return;
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
    loadFiles(parent);
  };

  const navigateToPath = (targetPath: string) => {
    loadFiles(targetPath);
  };

  const handleDoubleClick = (file: RemoteFile) => {
    if (file.type === 'directory') {
      navigateTo(file.name);
    }
  };

  const handleDownload = async (file: RemoteFile) => {
    const remotePath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
    await window.electronAPI.sftpDownload(sessionId, remotePath);
    setContextMenu(null);
  };

  const handleUpload = async () => {
    const result = await window.electronAPI.sftpUpload(sessionId, currentPath);
    if (result.success) {
      loadFiles(currentPath);
    }
  };

  const handleDelete = async (file: RemoteFile) => {
    const remotePath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
    const confirmed = confirm(`Delete "${file.name}"?`);
    if (!confirmed) return;

    let result;
    if (file.type === 'directory') {
      result = await window.electronAPI.sftpRmdir(sessionId, remotePath);
    } else {
      result = await window.electronAPI.sftpDelete(sessionId, remotePath);
    }

    if (result.success) {
      loadFiles(currentPath);
    } else {
      alert(`Delete failed: ${result.error}`);
    }
    setContextMenu(null);
  };

  const handleRename = async (file: RemoteFile) => {
    setRenameTarget(file.name);
    setRenameValue(file.name);
    setContextMenu(null);
  };

  const submitRename = async () => {
    if (!renameTarget || !renameValue.trim() || renameValue === renameTarget) {
      setRenameTarget(null);
      return;
    }
    const oldPath = currentPath === '/' ? `/${renameTarget}` : `${currentPath}/${renameTarget}`;
    const newPath = currentPath === '/' ? `/${renameValue}` : `${currentPath}/${renameValue}`;

    const result = await window.electronAPI.sftpRename(sessionId, oldPath, newPath);
    if (result.success) {
      loadFiles(currentPath);
    } else {
      alert(`Rename failed: ${result.error}`);
    }
    setRenameTarget(null);
  };

  const handleNewFolder = async () => {
    if (!newFolderName.trim()) {
      setNewFolderMode(false);
      return;
    }
    const remotePath = currentPath === '/' ? `/${newFolderName}` : `${currentPath}/${newFolderName}`;
    const result = await window.electronAPI.sftpMkdir(sessionId, remotePath);
    if (result.success) {
      loadFiles(currentPath);
    } else {
      alert(`Create folder failed: ${result.error}`);
    }
    setNewFolderMode(false);
    setNewFolderName('');
  };

  const handleContextMenu = (e: React.MouseEvent, file: RemoteFile) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
    setSelectedFile(file.name);
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '—';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  };

  const breadcrumbs = currentPath.split('/').filter(Boolean);

  if (!isVisible) return null;

  return (
    <div className="h-full bg-sidebar-bg border-l border-border flex flex-col overflow-hidden" onClick={() => setContextMenu(null)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <span className="text-xs font-semibold text-terminal-fg/80">File Browser</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => loadFiles(currentPath)}
            className="p-1 rounded hover:bg-sidebar-hover transition-colors"
            title="Refresh"
            disabled={loading}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={onToggle}
            className="p-1 rounded hover:bg-sidebar-hover transition-colors"
            title="Close file browser"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/30">
        <button
          onClick={navigateUp}
          className="p-1.5 rounded hover:bg-sidebar-hover transition-colors"
          title="Go up"
          disabled={currentPath === '/'}
        >
          <ArrowUp size={13} />
        </button>
        <button
          onClick={() => navigateToPath('/')}
          className="p-1.5 rounded hover:bg-sidebar-hover transition-colors"
          title="Home"
        >
          <Home size={13} />
        </button>
        <div className="w-px h-4 bg-border/50 mx-1" />
        <button
          onClick={handleUpload}
          className="p-1.5 rounded hover:bg-sidebar-hover transition-colors text-success"
          title="Upload file"
        >
          <Upload size={13} />
        </button>
        <button
          onClick={() => { setNewFolderMode(true); setNewFolderName(''); }}
          className="p-1.5 rounded hover:bg-sidebar-hover transition-colors text-accent"
          title="New folder"
        >
          <FolderPlus size={13} />
        </button>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-0.5 px-3 py-1.5 text-xs text-terminal-fg/50 overflow-x-auto border-b border-border/20">
        <button
          onClick={() => navigateToPath('/')}
          className="hover:text-accent transition-colors shrink-0"
        >
          /
        </button>
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-0.5 shrink-0">
            <ChevronRight size={10} />
            <button
              onClick={() => navigateToPath('/' + breadcrumbs.slice(0, i + 1).join('/'))}
              className="hover:text-accent transition-colors"
            >
              {crumb}
            </button>
          </span>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-2 text-xs text-error bg-error/10 border-b border-error/20">
          {error}
        </div>
      )}

      {/* New Folder Input */}
      {newFolderMode && (
        <div className="px-3 py-2 border-b border-border/30">
          <div className="flex items-center gap-2">
            <FolderPlus size={14} className="text-accent shrink-0" />
            <input
              type="text"
              className="input-field text-xs py-1"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNewFolder();
                if (e.key === 'Escape') setNewFolderMode(false);
              }}
              autoFocus
            />
          </div>
        </div>
      )}

      {/* File List */}
      <div className="flex-1 overflow-y-auto">
        {loading && files.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-terminal-fg/30">
            <RefreshCw size={16} className="animate-spin" />
          </div>
        ) : (
          <div className="py-1">
            {files.map((file) => (
              <div
                key={file.name}
                className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors text-xs ${
                  selectedFile === file.name ? 'bg-accent/10 text-accent' : 'hover:bg-sidebar-hover'
                }`}
                onClick={() => setSelectedFile(file.name)}
                onDoubleClick={() => handleDoubleClick(file)}
                onContextMenu={(e) => handleContextMenu(e, file)}
              >
                {/* Icon */}
                <div className="shrink-0">
                  {file.type === 'directory' ? (
                    <Folder size={14} className="text-warning" />
                  ) : (
                    <FileIcon name={file.name} />
                  )}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  {renameTarget === file.name ? (
                    <input
                      type="text"
                      className="input-field text-xs py-0 px-1"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitRename();
                        if (e.key === 'Escape') setRenameTarget(null);
                      }}
                      onBlur={submitRename}
                      autoFocus
                    />
                  ) : (
                    <span className="truncate block">{file.name}</span>
                  )}
                </div>

                {/* Size */}
                <span className="text-terminal-fg/30 shrink-0 text-[10px]">
                  {file.type === 'file' ? formatSize(file.size) : ''}
                </span>
              </div>
            ))}

            {files.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-8 text-terminal-fg/30">
                <Folder size={24} className="mb-2" />
                <span className="text-xs">Empty directory</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="px-3 py-1.5 border-t border-border/50 text-[10px] text-terminal-fg/40">
        {files.length} items • {currentPath}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          file={contextMenu.file}
          onDownload={() => handleDownload(contextMenu.file)}
          onRename={() => handleRename(contextMenu.file)}
          onDelete={() => handleDelete(contextMenu.file)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

// File icon helper
function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase();
  const textExts = ['txt', 'md', 'log', 'json', 'yml', 'yaml', 'xml', 'csv', 'conf', 'cfg', 'ini', 'sh', 'bash', 'py', 'js', 'ts', 'html', 'css'];

  if (textExts.includes(ext || '')) {
    return <FileText size={14} className="text-accent/60" />;
  }
  return <File size={14} className="text-terminal-fg/40" />;
}

// Context Menu
interface ContextMenuProps {
  x: number;
  y: number;
  file: RemoteFile;
  onDownload: () => void;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function ContextMenu({ x, y, file, onDownload, onRename, onDelete }: ContextMenuProps) {
  return (
    <div
      className="fixed z-50 bg-surface border border-border rounded-lg shadow-xl py-1 min-w-[160px]"
      style={{ left: Math.min(x, window.innerWidth - 180), top: Math.min(y, window.innerHeight - 150) }}
      onClick={(e) => e.stopPropagation()}
    >
      {file.type === 'file' && (
        <button
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-sidebar-hover transition-colors text-left"
          onClick={onDownload}
        >
          <Download size={12} />
          Download
        </button>
      )}
      <button
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-sidebar-hover transition-colors text-left"
        onClick={onRename}
      >
        <Edit size={12} />
        Rename
      </button>
      <div className="h-px bg-border/50 my-1" />
      <button
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-sidebar-hover transition-colors text-left text-error"
        onClick={onDelete}
      >
        <Trash2 size={12} />
        Delete
      </button>
    </div>
  );
}

export default FileBrowser;
