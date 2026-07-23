import React, { useState, useEffect } from 'react';
import {
  Server,
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit,
  Wifi,
  Settings,
  Folder,
  FolderPlus,
} from 'lucide-react';
import { SavedConnection } from '../types/electron';

interface SidebarProps {
  collapsed: boolean;
  refreshTrigger: number;
  onToggle: () => void;
  onConnect: (connection: SavedConnection) => void;
  onNewConnection: () => void;
  onEditConnection: (connection: SavedConnection) => void;
  onOpenSettings: () => void;
}

function Sidebar({ collapsed, refreshTrigger, onToggle, onConnect, onNewConnection, onEditConnection, onOpenSettings }: SidebarProps) {
  const [connections, setConnections] = useState<SavedConnection[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [newFolderMode, setNewFolderMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);
  const [folderContextMenu, setFolderContextMenu] = useState<{ x: number; y: number; group: string } | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState('');

  useEffect(() => {
    loadConnections();
  }, [refreshTrigger]);

  const loadConnections = async () => {
    const conns = await window.electronAPI.getConnections();
    setConnections(conns);
    // Cache groups for ConnectionDialog
    const groups = [...new Set(conns.map((c) => c.group).filter(Boolean))] as string[];
    localStorage.setItem('sc-groups-cache', JSON.stringify(groups));
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this connection?')) {
      await window.electronAPI.deleteConnection(id);
      loadConnections();
    }
  };

  const handleEdit = (e: React.MouseEvent, connection: SavedConnection) => {
    e.stopPropagation();
    onEditConnection(connection);
  };

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  // Create empty folder
  const handleCreateFolder = () => {
    if (!newFolderName.trim()) {
      setNewFolderMode(false);
      return;
    }
    setCollapsedGroups((prev) => ({ ...prev, [newFolderName.trim()]: false }));
    const existingFolders = JSON.parse(localStorage.getItem('sc-folders') || '[]');
    existingFolders.push(newFolderName.trim());
    localStorage.setItem('sc-folders', JSON.stringify([...new Set(existingFolders)]));
    setNewFolderMode(false);
    setNewFolderName('');
    loadConnections();
  };

  // Delete folder — moves all connections inside to root
  const handleDeleteFolder = async (group: string) => {
    const connsInGroup = connections.filter((c) => c.group === group);
    const hasConnections = connsInGroup.length > 0;

    const message = hasConnections
      ? `Delete folder "${group}"? ${connsInGroup.length} session(s) inside will be moved to root.`
      : `Delete empty folder "${group}"?`;

    if (!confirm(message)) return;

    // Move all connections in this group to root
    for (const conn of connsInGroup) {
      await window.electronAPI.saveConnection({ ...conn, group: undefined });
    }

    // Remove from saved folders
    const savedFolders = JSON.parse(localStorage.getItem('sc-folders') || '[]');
    const updated = savedFolders.filter((f: string) => f !== group);
    localStorage.setItem('sc-folders', JSON.stringify(updated));

    setFolderContextMenu(null);
    loadConnections();
  };

  // Rename folder — uses inline input
  const handleRenameFolder = (oldName: string) => {
    setRenamingFolder(oldName);
    setRenameFolderValue(oldName);
    setFolderContextMenu(null);
  };

  const submitRenameFolder = async () => {
    if (!renamingFolder || !renameFolderValue.trim() || renameFolderValue.trim() === renamingFolder) {
      setRenamingFolder(null);
      return;
    }

    const newName = renameFolderValue.trim();
    const connsInGroup = connections.filter((c) => c.group === renamingFolder);
    for (const conn of connsInGroup) {
      await window.electronAPI.saveConnection({ ...conn, group: newName });
    }

    const savedFolders = JSON.parse(localStorage.getItem('sc-folders') || '[]');
    const updated = savedFolders.map((f: string) => f === renamingFolder ? newName : f);
    localStorage.setItem('sc-folders', JSON.stringify([...new Set(updated)]));

    setRenamingFolder(null);
    loadConnections();
  };

  // Drag & Drop
  const handleDragStart = (e: React.DragEvent, connId: string) => {
    setDraggedId(connId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, group: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverGroup(group);
  };

  const handleDragLeave = () => {
    setDragOverGroup(null);
  };

  const handleDrop = async (e: React.DragEvent, targetGroup: string) => {
    e.preventDefault();
    setDragOverGroup(null);

    if (!draggedId) return;

    const conn = connections.find((c) => c.id === draggedId);
    if (!conn || conn.group === targetGroup) {
      setDraggedId(null);
      return;
    }

    // Move connection to new group
    await window.electronAPI.saveConnection({ ...conn, group: targetGroup || undefined });
    setDraggedId(null);
    loadConnections();
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverGroup(null);
  };

  const filteredConnections = connections.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.host.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get all groups including empty folders from localStorage
  const savedFolders: string[] = JSON.parse(localStorage.getItem('sc-folders') || '[]');

  const groupedConnections = filteredConnections.reduce((acc, conn) => {
    const group = conn.group || '';
    if (!acc[group]) acc[group] = [];
    acc[group].push(conn);
    return acc;
  }, {} as Record<string, SavedConnection[]>);

  // Add empty folders
  for (const folder of savedFolders) {
    if (!groupedConnections[folder]) {
      groupedConnections[folder] = [];
    }
  }

  // Sort groups
  const sortedGroups = Object.keys(groupedConnections).sort((a, b) => {
    if (a === '') return -1;
    if (b === '') return 1;
    return a.localeCompare(b);
  });

  if (collapsed) {
    return (
      <div className="w-12 bg-sidebar-bg border-r border-border flex flex-col items-center py-4 gap-4">
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-sidebar-hover transition-colors"
          aria-label="Expand sidebar"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={onNewConnection}
          className="p-2 rounded-lg hover:bg-sidebar-hover transition-colors text-accent"
          aria-label="New connection"
        >
          <Plus size={16} />
        </button>
        <div className="w-8 h-px bg-border" />
        {connections.slice(0, 5).map((conn) => (
          <button
            key={conn.id}
            onClick={() => onConnect(conn)}
            className="p-2 rounded-lg hover:bg-sidebar-hover transition-colors"
            title={`${conn.name} (${conn.host})`}
            aria-label={`Connect to ${conn.name}`}
          >
            <Server size={14} />
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-lg hover:bg-sidebar-hover transition-colors"
          aria-label="Settings"
        >
          <Settings size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="h-full bg-sidebar-bg border-r border-border flex flex-col overflow-hidden" onClick={() => setFolderContextMenu(null)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/50">
        <h2 className="text-xs font-semibold text-terminal-fg/90">Connections</h2>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => { setNewFolderMode(true); setNewFolderName(''); }}
            className="p-1.5 rounded-md hover:bg-sidebar-hover transition-colors text-warning/70"
            title="New Folder"
            aria-label="New folder"
          >
            <FolderPlus size={14} />
          </button>
          <button
            onClick={onNewConnection}
            className="p-1.5 rounded-md hover:bg-sidebar-hover transition-colors text-accent"
            title="New Connection"
            aria-label="New connection"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-md hover:bg-sidebar-hover transition-colors"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft size={14} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-2 py-2">
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-field text-xs py-1.5"
        />
      </div>

      {/* New Folder Input */}
      {newFolderMode && (
        <div className="px-2 pb-2">
          <div className="flex items-center gap-1.5 px-2 py-1.5 bg-surface rounded-lg border border-accent/30">
            <FolderPlus size={12} className="text-warning shrink-0" />
            <input
              type="text"
              className="flex-1 bg-transparent text-xs text-terminal-fg outline-none placeholder-terminal-fg/30"
              placeholder="Folder name..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder();
                if (e.key === 'Escape') setNewFolderMode(false);
              }}
              onBlur={() => { if (!newFolderName.trim()) setNewFolderMode(false); }}
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Connection List */}
      <div className="flex-1 overflow-y-auto px-1 pb-2">
        {sortedGroups.map((group) => {
          const conns = groupedConnections[group];
          const isCollapsed = collapsedGroups[group];
          const groupName = group ? group.split('/').pop() || group : '';
          const isDragOver = dragOverGroup === group;

          return (
            <div key={group} className="mb-1">
              {/* Group Header */}
              {group && (
                <div
                  className={`flex items-center gap-1.5 w-full px-2 py-1 rounded transition-colors cursor-pointer ${
                    isDragOver ? 'bg-accent/20 border border-accent/40' : 'hover:bg-sidebar-hover border border-transparent'
                  }`}
                  onClick={() => { if (renamingFolder !== group) toggleGroup(group); }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setFolderContextMenu({ x: e.clientX, y: e.clientY, group });
                  }}
                  onDragOver={(e) => handleDragOver(e, group)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, group)}
                >
                  <ChevronRight
                    size={10}
                    className={`text-terminal-fg/40 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                  />
                  <Folder size={12} className="text-warning/70" />
                  {renamingFolder === group ? (
                    <input
                      type="text"
                      className="flex-1 bg-terminal-bg text-xs text-terminal-fg px-1 py-0.5 rounded border border-accent outline-none"
                      value={renameFolderValue}
                      onChange={(e) => setRenameFolderValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitRenameFolder();
                        if (e.key === 'Escape') setRenamingFolder(null);
                        e.stopPropagation();
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={submitRenameFolder}
                      autoFocus
                    />
                  ) : (
                    <>
                      <span className="text-[11px] text-terminal-fg/60 truncate flex-1">{groupName}</span>
                      <span className="text-[10px] text-terminal-fg/30">{conns.length}</span>
                    </>
                  )}
                </div>
              )}

              {/* Ungrouped drop zone */}
              {!group && (
                <div
                  className={`${isDragOver ? 'bg-accent/10 rounded border border-accent/30' : 'border border-transparent'}`}
                  onDragOver={(e) => handleDragOver(e, '')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, '')}
                >
                  {/* Connections without group */}
                  {conns.map((conn) => (
                    <div
                      key={conn.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, conn.id)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-all hover:bg-sidebar-hover group/item ${
                        draggedId === conn.id ? 'opacity-40' : ''
                      }`}
                      onClick={() => onConnect(conn)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && onConnect(conn)}
                    >
                      <Wifi size={11} className="text-success/70 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate leading-tight">{conn.name}</div>
                        <div className="text-[10px] text-terminal-fg/40 truncate leading-tight">
                          {conn.username}@{conn.host}
                        </div>
                      </div>
                      <div className="hidden group-hover/item:flex items-center gap-0.5">
                        <button
                          onClick={(e) => handleEdit(e, conn)}
                          className="p-0.5 rounded hover:bg-surface-light"
                          aria-label={`Edit ${conn.name}`}
                        >
                          <Edit size={10} />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, conn.id)}
                          className="p-0.5 rounded hover:bg-error/20 text-error"
                          aria-label={`Delete ${conn.name}`}
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Grouped connections */}
              {group && !isCollapsed && (
                <div
                  className={`pl-3 ${isDragOver ? '' : ''}`}
                  onDragOver={(e) => handleDragOver(e, group)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, group)}
                >
                  {conns.map((conn) => (
                    <div
                      key={conn.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, conn.id)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-all hover:bg-sidebar-hover group/item ${
                        draggedId === conn.id ? 'opacity-40' : ''
                      }`}
                      onClick={() => onConnect(conn)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && onConnect(conn)}
                    >
                      <Wifi size={11} className="text-success/70 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate leading-tight">{conn.name}</div>
                        <div className="text-[10px] text-terminal-fg/40 truncate leading-tight">
                          {conn.username}@{conn.host}
                        </div>
                      </div>
                      <div className="hidden group-hover/item:flex items-center gap-0.5">
                        <button
                          onClick={(e) => handleEdit(e, conn)}
                          className="p-0.5 rounded hover:bg-surface-light"
                          aria-label={`Edit ${conn.name}`}
                        >
                          <Edit size={10} />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, conn.id)}
                          className="p-0.5 rounded hover:bg-error/20 text-error"
                          aria-label={`Delete ${conn.name}`}
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {conns.length === 0 && (
                    <div className="px-2 py-2 text-[10px] text-terminal-fg/30 italic">
                      Empty — drag sessions here
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredConnections.length === 0 && sortedGroups.length <= 1 && (
          <div className="flex flex-col items-center justify-center py-8 text-terminal-fg/40">
            <Server size={24} className="mb-2" />
            <p className="text-xs">No connections</p>
            <button
              onClick={onNewConnection}
              className="mt-2 text-[10px] text-accent hover:text-accent-hover transition-colors"
            >
              + Add connection
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border/50 flex items-center justify-between">
        <span className="text-[10px] text-terminal-fg/40">
          {connections.length} session{connections.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={onOpenSettings}
          className="p-1 rounded hover:bg-sidebar-hover transition-colors text-terminal-fg/40 hover:text-terminal-fg"
          title="Settings"
          aria-label="Open settings"
        >
          <Settings size={12} />
        </button>
      </div>

      {/* Folder Context Menu */}
      {folderContextMenu && (
        <div
          className="fixed z-50 bg-surface border border-border rounded-lg shadow-xl py-1 min-w-[140px]"
          style={{
            left: Math.min(folderContextMenu.x, window.innerWidth - 160),
            top: Math.min(folderContextMenu.y, window.innerHeight - 120),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-sidebar-hover transition-colors text-left"
            onClick={() => handleRenameFolder(folderContextMenu.group)}
          >
            <Edit size={11} />
            Rename Folder
          </button>
          <div className="h-px bg-border/50 my-0.5" />
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-sidebar-hover transition-colors text-left text-error"
            onClick={() => handleDeleteFolder(folderContextMenu.group)}
          >
            <Trash2 size={11} />
            Delete Folder
          </button>
        </div>
      )}
    </div>
  );
}

export default Sidebar;
