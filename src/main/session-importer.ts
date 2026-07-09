import fs from 'fs';

export interface ImportedConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  privateKeyPath?: string;
  group?: string;
}

/**
 * Parse .ini or .mxtsessions file and extract SSH sessions.
 * 
 * Session files store bookmarks in INI format:
 * [Bookmarks_1]
 * SubRep=MyGroup
 * ImgNum=41
 * MyServer=#109#0%hostname%22%username%...
 * 
 * Session format (# separated):
 * #SessionType#...%host%port%username%...
 * SessionType 109 = SSH
 */
export function parseSessionFile(filePath: string): ImportedConnection[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const connections: ImportedConnection[] = [];
  const lines = content.split(/\r?\n/);

  let currentGroup = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect section headers like [Bookmarks_1]
    if (line.startsWith('[') && line.endsWith(']')) {
      continue;
    }

    // SubRep defines the group/folder
    if (line.startsWith('SubRep=')) {
      currentGroup = line.substring(7).replace(/\\\\/g, '/').replace(/\\/g, '/');
      continue;
    }

    // Skip non-session lines
    if (!line.includes('=') || line.startsWith('ImgNum=')) {
      continue;
    }

    // Try to parse session line: SessionName=#Type#...%host%port%username%...
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;

    const sessionName = line.substring(0, eqIndex).trim();
    const sessionValue = line.substring(eqIndex + 1).trim();

    // Session format starts with #
    if (!sessionValue.startsWith('#')) continue;

    const parsed = parseSession(sessionName, sessionValue, currentGroup);
    if (parsed) {
      connections.push(parsed);
    }
  }

  return connections;
}

function parseSession(name: string, value: string, group: string): ImportedConnection | null {
  try {
    // Remove leading #, split by #
    const hashParts = value.substring(1).split('#');
    if (hashParts.length < 2) return null;

    const sessionType = parseInt(hashParts[0], 10);

    // 109 = SSH, 98 = SSH (older format)
    if (sessionType !== 109 && sessionType !== 98) return null;

    // The rest is % separated parameters
    const params = hashParts[1].split('%');

    // Typical format: flags%host%port%username%...
    // Position varies by version, try common patterns
    let host = '';
    let port = 22;
    let username = '';
    let privateKeyPath = '';

    if (params.length >= 4) {
      // Common format: 0%host%port%username%...
      host = params[1] || '';
      port = parseInt(params[2], 10) || 22;
      username = params[3] || '';
    }

    // Look for private key path in remaining params (usually around index 8-12)
    for (let i = 4; i < params.length; i++) {
      const p = params[i];
      // Private key paths usually contain backslash or .pem/.key
      if (p && (p.includes(':\\') || p.includes('/.ssh/') || p.endsWith('.pem') || p.endsWith('.key') || p.endsWith('.ppk'))) {
        privateKeyPath = p;
        break;
      }
    }

    if (!host) return null;

    // If no password and no key, set authType to 'password' — 
    // the app will fall back to default SSH key from settings
    return {
      id: generateId(),
      name: name || `${username}@${host}`,
      host,
      port,
      username: username || 'root',
      authType: privateKeyPath ? 'key' : 'password',
      privateKeyPath: privateKeyPath || undefined,
      group: group || undefined,
    };
  } catch {
    return null;
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}
