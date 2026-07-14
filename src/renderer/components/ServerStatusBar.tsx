import { useState, useEffect, useRef } from 'react';
import { Cpu, HardDrive, MemoryStick, Clock, User, Server, Activity } from 'lucide-react';

interface ServerStatusBarProps {
  sessionId: string;
  isConnected: boolean;
  connectionName: string;
  host: string;
}

interface ServerStats {
  hostname: string;
  username: string;
  loadAvg: string;
  memUsed: string;
  memTotal: string;
  memPercent: number;
  diskPercent: string;
  uptime: string;
}

function ServerStatusBar({ sessionId, isConnected, connectionName, host }: ServerStatusBarProps) {
  const [stats, setStats] = useState<ServerStats | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isConnected || !sessionId) return;

    // Initial fetch after 2s (give connection time to fully establish)
    const startDelay = setTimeout(() => {
      fetchStats();
      // Refresh every 15 seconds
      intervalRef.current = setInterval(fetchStats, 15000);
    }, 2000);

    return () => {
      clearTimeout(startDelay);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [sessionId, isConnected]);

  const fetchStats = async () => {
    try {
      // Single command that outputs all stats separated by |
      const cmd = `echo "$(hostname)|$(whoami)|$(awk '{print $1}' /proc/loadavg)|$(free -m | awk '/Mem:/{printf "%dMB|%dMB|%d", $3, $2, $3*100/$2}')|$(df -h / | awk 'NR==2{print $5}')|$(uptime -p 2>/dev/null || awk '{d=int($1/86400);h=int(($1%86400)/3600);printf \"up %dd %dh\",d,h}' /proc/uptime)"`;

      const result = await window.electronAPI.sshExec(sessionId, cmd);
      if (!result.success || !result.output) return;

      const parts = result.output.split('|');
      if (parts.length >= 7) {
        setStats({
          hostname: parts[0] || '',
          username: parts[1] || '',
          loadAvg: parts[2] || '0',
          memUsed: parts[3] || '0MB',
          memTotal: parts[4] || '0MB',
          memPercent: parseInt(parts[5]) || 0,
          diskPercent: parts[6] || '0%',
          uptime: parts[7] || '',
        });
      }
    } catch {
      // Silently fail — don't break the UI
    }
  };

  if (!isConnected) {
    return (
      <div className="h-5 bg-[#13131a] border-t border-border/30 flex items-center px-3 text-[10px] text-error/60">
        <span>● Disconnected</span>
      </div>
    );
  }

  return (
    <div className="h-5 bg-[#13131a] border-t border-border/30 flex items-center px-2 gap-3 text-[10px] text-terminal-fg/50 overflow-x-auto">
      {/* Hostname */}
      <div className="flex items-center gap-1 shrink-0">
        <Server size={9} className="text-accent/60" />
        <span className="text-terminal-fg/70">{stats?.hostname || connectionName}</span>
      </div>

      {stats && (
        <>
          <div className="w-px h-2.5 bg-border/30" />

          {/* User */}
          <div className="flex items-center gap-1 shrink-0">
            <User size={9} />
            <span>{stats.username}</span>
          </div>

          <div className="w-px h-2.5 bg-border/30" />

          {/* Load */}
          <div className="flex items-center gap-1 shrink-0">
            <Cpu size={9} className="text-success/60" />
            <span>{stats.loadAvg}</span>
          </div>

          <div className="w-px h-2.5 bg-border/30" />

          {/* Memory */}
          <div className="flex items-center gap-1 shrink-0">
            <MemoryStick size={9} className="text-warning/60" />
            <span>{stats.memUsed}/{stats.memTotal}</span>
            <span className={stats.memPercent > 80 ? 'text-error' : ''}>{stats.memPercent}%</span>
          </div>

          <div className="w-px h-2.5 bg-border/30" />

          {/* Disk */}
          <div className="flex items-center gap-1 shrink-0">
            <HardDrive size={9} className="text-accent/60" />
            <span>/: {stats.diskPercent}</span>
          </div>

          <div className="w-px h-2.5 bg-border/30" />

          {/* Uptime */}
          <div className="flex items-center gap-1 shrink-0">
            <Clock size={9} />
            <span>{stats.uptime}</span>
          </div>
        </>
      )}

      {/* Right side — IP */}
      <div className="ml-auto flex items-center gap-1 shrink-0">
        <Activity size={9} className="text-success/40" />
        <span className="text-terminal-fg/30">{host}</span>
      </div>
    </div>
  );
}

export default ServerStatusBar;
