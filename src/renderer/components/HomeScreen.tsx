import { useState, useEffect, useRef } from 'react';
import { Terminal, Search, Wifi } from 'lucide-react';
import { SavedConnection } from '../types/electron';

interface HomeScreenProps {
  onConnect?: (searchOrConnection: string | SavedConnection) => void;
}

function HomeScreen({ onConnect }: HomeScreenProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [connections, setConnections] = useState<SavedConnection[]>([]);
  const [filteredResults, setFilteredResults] = useState<SavedConnection[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    const conns = await window.electronAPI.getConnections();
    setConnections(conns);
  };

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredResults([]);
      setShowDropdown(false);
      return;
    }

    const term = searchTerm.toLowerCase();
    const results = connections.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.host.toLowerCase().includes(term) ||
        c.username?.toLowerCase().includes(term)
    );
    setFilteredResults(results.slice(0, 8)); // Max 8 results
    setShowDropdown(results.length > 0);
    setSelectedIndex(0);
  }, [searchTerm, connections]);

  const handleSelect = (conn: SavedConnection) => {
    onConnect?.(conn);
    setSearchTerm('');
    setShowDropdown(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) {
      if (e.key === 'Enter' && searchTerm.trim()) {
        onConnect?.(searchTerm.trim());
        setSearchTerm('');
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filteredResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredResults[selectedIndex]) {
        handleSelect(filteredResults[selectedIndex]);
      } else if (searchTerm.trim()) {
        onConnect?.(searchTerm.trim());
        setSearchTerm('');
        setShowDropdown(false);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-terminal-fg/30">
      <Terminal size={48} className="mb-3 text-accent/40" />
      <h2 className="text-lg font-semibold mb-1 text-terminal-fg/60">NexTerm</h2>
      <p className="text-xs mb-6 text-terminal-fg/30">SSH Connection Manager</p>

      {/* SSH-only quick connection */}
      <div className="w-80 relative mb-6">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-terminal-fg/30 z-10" />
        <input
          ref={inputRef}
          type="text"
          className="input-field pl-9 text-sm"
          placeholder="ssh user@host or saved server name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (filteredResults.length > 0) setShowDropdown(true); }}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        />

        {/* Dropdown results */}
        {showDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-xl overflow-hidden z-50 max-h-72 overflow-y-auto">
            {filteredResults.map((conn, idx) => (
              <div
                key={conn.id}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                  idx === selectedIndex ? 'bg-accent/10 text-accent' : 'hover:bg-sidebar-hover'
                }`}
                onMouseDown={() => handleSelect(conn)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <Wifi size={12} className="text-success/60 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{conn.name}</div>
                  <div className="text-[10px] text-terminal-fg/40 truncate">
                    {conn.username ? `${conn.username}@` : ''}{conn.host}:{conn.port}
                  </div>
                </div>
                {conn.group && (
                  <span className="text-[9px] text-terminal-fg/30 bg-surface-light px-1.5 py-0.5 rounded">
                    {conn.group}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hint */}
      <p className="text-[10px] text-terminal-fg/20 mt-3">
        Enter a saved server name, IP, or ssh user@host • Enter to connect
      </p>
    </div>
  );
}

export default HomeScreen;
