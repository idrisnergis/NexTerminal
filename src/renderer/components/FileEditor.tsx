import { useState, useEffect, useCallback } from 'react';
import { X, Save, RefreshCw, FileText, Check, AlertCircle } from 'lucide-react';

interface FileEditorProps {
  sessionId: string;
  filePath: string;
  fileName: string;
  onClose: () => void;
}

function FileEditor({ sessionId, filePath, fileName, onClose }: FileEditorProps) {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const isDirty = content !== originalContent;

  const loadFile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.sftpReadFile(sessionId, filePath);
      if (result.success && result.content !== undefined) {
        setContent(result.content);
        setOriginalContent(result.content);
      } else {
        setError(result.error || 'Failed to read file');
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }, [sessionId, filePath]);

  useEffect(() => {
    loadFile();
  }, [loadFile]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await window.electronAPI.sftpWriteFile(sessionId, filePath, content);
      if (result.success) {
        setOriginalContent(content);
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2000);
      } else {
        setError(result.error || 'Failed to save file');
      }
    } catch (err: any) {
      setError(err.message);
    }
    setSaving(false);
  }, [sessionId, filePath, content]);

  // Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (isDirty) handleSave();
      }
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const handleClose = () => {
    if (isDirty && !confirm('You have unsaved changes. Close anyway?')) return;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-8" onClick={handleClose}>
      <div
        className="bg-terminal-bg w-full max-w-4xl h-full max-h-[85vh] rounded-xl shadow-2xl border border-border flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-sidebar-bg shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={15} className="text-accent shrink-0" />
            <span className="text-sm font-medium truncate">{fileName}</span>
            {isDirty && <span className="text-warning text-lg leading-none" title="Unsaved changes">•</span>}
            <span className="text-[10px] text-terminal-fg/40 truncate hidden sm:block">{filePath}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {savedFlash && (
              <span className="flex items-center gap-1 text-xs text-success mr-2">
                <Check size={12} /> Saved
              </span>
            )}
            <button
              onClick={loadFile}
              className="p-1.5 rounded hover:bg-surface-light transition-colors"
              title="Reload"
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors disabled:opacity-40"
              disabled={!isDirty || saving}
              title="Save (Ctrl+S)"
            >
              {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
              Save
            </button>
            <button onClick={handleClose} className="p-1.5 rounded hover:bg-surface-light transition-colors" title="Close (Esc)">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-2 text-xs text-error bg-error/10 border-b border-error/20 flex items-center gap-2 shrink-0">
            <AlertCircle size={12} />
            <span>{error}</span>
          </div>
        )}

        {/* Editor */}
        <div className="flex-1 overflow-hidden relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center text-terminal-fg/30">
              <RefreshCw size={20} className="animate-spin" />
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
              className="w-full h-full resize-none bg-terminal-bg text-terminal-fg p-4 outline-none font-mono text-sm leading-relaxed"
              style={{ fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Menlo, Monaco, monospace", tabSize: 4 }}
              autoFocus
            />
          )}
        </div>

        {/* Status bar */}
        <div className="px-4 py-1.5 border-t border-border bg-sidebar-bg text-[10px] text-terminal-fg/40 flex items-center justify-between shrink-0">
          <span>{content.split('\n').length} lines · {content.length} chars</span>
          <span>{isDirty ? 'Modified' : 'Saved'} · Ctrl+S to save · Esc to close</span>
        </div>
      </div>
    </div>
  );
}

export default FileEditor;
