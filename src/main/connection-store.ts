import { app } from 'electron';
import path from 'path';
import fs from 'fs';

export interface SavedConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  privateKeyPath?: string;
  group?: string;
  lastConnected?: string;
}

// Portable data directory — next to the app itself
function getPortableDataDir(): string {
  if (app.isPackaged) {
    // Packaged: data folder next to the exe
    return path.join(path.dirname(app.getPath('exe')), 'data');
  } else {
    // Development: data folder in project root
    return path.join(path.dirname(__dirname), '..', 'data');
  }
}

export class ConnectionStore {
  private filePath: string;
  private connections: SavedConnection[] = [];

  constructor() {
    const dataDir = getPortableDataDir();
    this.filePath = path.join(dataDir, 'connections.json');
    this.migrateFromUserData();
    this.load();
  }

  // One-time migration from old userData location
  private migrateFromUserData(): void {
    if (fs.existsSync(this.filePath)) return; // Already have portable data
    try {
      // Check multiple possible old locations
      const possiblePaths = [
        path.join(app.getPath('userData'), 'connections.json'),
        path.join(app.getPath('appData'), 'Electron', 'connections.json'),
        path.join(app.getPath('appData'), 'nexterm', 'connections.json'),
        path.join(app.getPath('appData'), 'NexTerm', 'connections.json'),
      ];
      for (const oldPath of possiblePaths) {
        if (fs.existsSync(oldPath)) {
          const dir = path.dirname(this.filePath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.copyFileSync(oldPath, this.filePath);
          break;
        }
      }
    } catch {
      // Ignore migration errors
    }
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        this.connections = JSON.parse(data);
      }
    } catch {
      this.connections = [];
    }
  }

  private persist(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.connections, null, 2));
    } catch (error) {
      console.error('Failed to save connections:', error);
    }
  }

  getAll(): SavedConnection[] {
    return this.connections;
  }

  save(connection: SavedConnection): void {
    const index = this.connections.findIndex((c) => c.id === connection.id);
    if (index >= 0) {
      this.connections[index] = connection;
    } else {
      this.connections.push(connection);
    }
    this.persist();
  }

  delete(id: string): void {
    this.connections = this.connections.filter((c) => c.id !== id);
    this.persist();
  }
}
