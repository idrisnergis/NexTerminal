import { app } from 'electron';
import path from 'path';
import fs from 'fs';

export interface AppSettings {
  defaultSSHKeyPath: string;
  defaultSSHKeyPassphrase: string;
  defaultUsername: string;
  defaultPort: number;
  useDefaultKeyForAll: boolean;
  sidebarFontSize: number;
  terminalFontSize: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultSSHKeyPath: '',
  defaultSSHKeyPassphrase: '',
  defaultUsername: '',
  defaultPort: 22,
  useDefaultKeyForAll: false,
  sidebarFontSize: 11,
  terminalFontSize: 14,
};

export class SettingsStore {
  private filePath: string;
  private settings: AppSettings;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.filePath = path.join(userDataPath, 'settings.json');
    this.settings = this.load();
  }

  private load(): AppSettings {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
      }
    } catch {
      // ignore
    }
    return { ...DEFAULT_SETTINGS };
  }

  private persist(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  getAll(): AppSettings {
    return { ...this.settings };
  }

  update(partial: Partial<AppSettings>): void {
    this.settings = { ...this.settings, ...partial };
    this.persist();
  }
}
