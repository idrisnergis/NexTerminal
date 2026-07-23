import { useState, useEffect, useRef } from 'react';
import {
  Folder,
  File,
  FileText,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Upload,
  Server,
} from 'lucide-react';
import { RemoteFile } from '../types/electron';

interface SidebarFileTreeProps {
  sessionId: string;
  connectionName: string;
  host: string;
  isConnected: boolean;
}

function SidebarFileTree({ sessionId, connectionName, host, isConnected }: SidebarFileTreeProps) {
  const [rootFiles, setRootFiles] = useState<RemoteFile[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [childrenCache, setChildrenCache] = useState<Record<string, RemoteFile[]>>({});
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Initialize SFTP and load root directory on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!isConnected || !sessionId) return;

      setInitialLoading(true);
      setError(null);

      // Step 1: Establish SFTP connection
      try {
        const connectResult = await window.electronAPI.sftpConnect(sessionId);
        if (cancelled) return;

        if (!connectResult.success) {
          // SSH might not be fully ready — wait and retry
          await new Promise((r) => setTimeout(r, 1500));
          if (cancelled) return;

          const retryResult = await window.electronAPI.sftpConnect(sessionId);
          if (cancelled) return;

          if (!retryResult.success) {
            // Third attempt after more delay
            await new Promise((r) => setTimeout(r, 2000));
            if (cancelled) return;

            const thirdResult = await window.electronAPI.sftpConnect(sessionId);
            if (cancelled) return;

            if (!thirdResult.success) {
              setError(thirdResult.error || 'SFTP connection failed');
              setInitialLoading(false);
              return;
            }
          }
        }
      } catch (err: any) {
        if (cancelled) return;
        setError(err.message);
        setInitialLoading(false);
        return;
      }

      // Step 2: List root directory
      try {
        const result = await window.electronAPI.sftpList(sessionId, '/');
        if (cancelled) return;

        if (result.success && result.files) {
          setRootFiles(result.files);
        } else {
          setError(result.error || 'Failed to list root directory');
        }
      } catch (err: any) {
        if (cancelled) return;
        setError(err.message);
      }

      if (!cancelled) {
        setInitialLoading(false);
      }
    }

    init();

    return () => { cancelled = true; };
  }, [sessionId, isConnected]);

  const loadSubDirectory = async (dirPath: string) => {
    setLoadingPaths((prev) => new Set(prev).add(dirPath));

    try {
      const result = await window.electronAPI.sftpList(sessionId, dirPath);
      if (mountedRef.current && result.success && result.files) {
        setChildrenCache((prev) => ({ ...prev, [dirPath]: result.files! }));
      }
    } catch (err) {
      // Silently fail for subdirectories
    }

    if (mountedRef.current) {
      setLoadingPaths((prev) => {
        const next = new Set(prev);
        next.delete(dirPath);
        return next;
      });
    }
  };

  const toggleExpand = (dirPath: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);
        // Load children if not cached
        if (!childrenCache[dirPath]) {
          loadSubDirectory(dirPath);
        }
      }
      return next;
    });
  };

  const handleUpload = async () => {
    const result = await window.electronAPI.sftpUpload(sessionId, '/');
    if (result.success) {
      // Reload root
      const listResult = await window.electronAPI.sftpList(sessionId, '/');
      if (listResult.success && listResult.files) {
        setRootFiles(listResult.files);
      }
    }
  };

  const refresh = async () => {
    setChildrenCache({});
    setExpandedPaths(new Set());
    setInitialLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.sftpList(sessionId, '/');
      if (result.success && result.files) {
        setRootFiles(result.files);
      } else {
        setError(result.error || 'Failed to refresh');
      }
    } catch (err: any) {
      setError(err.message);
    }
    setInitialLoading(false);
  };

  if (!isConnected) return null;

  return (
    <div className="flex flex-col border-t border-border overflow-hidden flex-1 min-h-0 bg-sidebar-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Server size={12} className="text-success shrink-0" />
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-terminal-fg/90 truncate">{connectionName}</div>
            <div className="text-[9px] text-terminal-fg/40 truncate">{host}</div>
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={handleUpload}
            className="p-1 rounded hover:bg-sidebar-hover transition-colors text-success/70"
            title="Upload to root"
          >
            <Upload size={11} />
          </button>
          <button
            onClick={refresh}
            className="p-1 rounded hover:bg-sidebar-hover transition-colors"
            title="Refresh"
          >
            <RefreshCw size={11} className={initialLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-2 text-[10px] text-error bg-error/5 border-b border-error/20">
          {error}
        </div>
      )}

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {initialLoading ? (
          <div className="flex items-center justify-center py-6 text-terminal-fg/30">
            <RefreshCw size={14} className="animate-spin" />
          </div>
        ) : rootFiles.length === 0 && !error ? (
          <div className="flex items-center justify-center py-6 text-terminal-fg/30 text-[11px]">
            Empty
          </div>
        ) : (
          <FileTreeLevel
            files={rootFiles}
            parentPath="/"
            expandedPaths={expandedPaths}
            childrenCache={childrenCache}
            loadingPaths={loadingPaths}
            onToggle={toggleExpand}
            depth={0}
          />
        )}
      </div>
    </div>
  );
}

// Recursive tree level component
interface FileTreeLevelProps {
  files: RemoteFile[];
  parentPath: string;
  expandedPaths: Set<string>;
  childrenCache: Record<string, RemoteFile[]>;
  loadingPaths: Set<string>;
  onToggle: (path: string) => void;
  depth: number;
}

function FileTreeLevel({ files, parentPath, expandedPaths, childrenCache, loadingPaths, onToggle, depth }: FileTreeLevelProps) {
  return (
    <>
      {files.map((file) => {
        const fullPath = parentPath === '/' ? `/${file.name}` : `${parentPath}/${file.name}`;
        const isDir = file.type === 'directory';
        const isExpanded = expandedPaths.has(fullPath);
        const isLoading = loadingPaths.has(fullPath);
        const children = childrenCache[fullPath];

        return (
          <div key={file.name}>
            <div
              className="flex items-center gap-1 px-2 py-[3px] cursor-pointer hover:bg-sidebar-hover transition-colors group/tree"
              style={{ paddingLeft: `${8 + depth * 12}px` }}
              onClick={() => isDir && onToggle(fullPath)}
              title={fullPath}
            >
              {/* Expand/Collapse arrow */}
              {isDir ? (
                <span className="w-3 h-3 flex items-center justify-center shrink-0">
                  {isLoading ? (
                    <RefreshCw size={9} className="animate-spin text-terminal-fg/40" />
                  ) : isExpanded ? (
                    <ChevronDown size={10} className="text-terminal-fg/50" />
                  ) : (
                    <ChevronRight size={10} className="text-terminal-fg/50" />
                  )}
                </span>
              ) : (
                <span className="w-3 h-3 shrink-0" />
              )}

              {/* Icon */}
              {isDir ? (
                <Folder size={12} className={isExpanded ? 'text-warning' : 'text-warning/70'} />
              ) : (
                <FileIcon name={file.name} />
              )}

              {/* Name */}
              <span className="text-[11px] text-terminal-fg/80 truncate flex-1">{file.name}</span>
            </div>

            {/* Children */}
            {isDir && isExpanded && children && (
              <FileTreeLevel
                files={children}
                parentPath={fullPath}
                expandedPaths={expandedPaths}
                childrenCache={childrenCache}
                loadingPaths={loadingPaths}
                onToggle={onToggle}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase();
  const textExts = ['txt', 'md', 'log', 'json', 'yml', 'yaml', 'xml', 'csv', 'conf', 'cfg', 'ini', 'sh', 'bash', 'py', 'js', 'ts', 'html', 'css'];

  if (textExts.includes(ext || '')) {
    return <FileText size={12} className="text-accent/60" />;
  }
  return <File size={12} className="text-terminal-fg/40" />;
}

export default SidebarFileTree;
