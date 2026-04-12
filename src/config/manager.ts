import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { StoredConfig } from './types.js';

const CONFIG_DIR = join(homedir(), '.openaicli');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const HISTORY_FILE = join(CONFIG_DIR, 'history');

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getHistoryFile(): string {
  return HISTORY_FILE;
}

export function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function readGlobalConfig(): StoredConfig {
  ensureConfigDir();
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw) as StoredConfig;
  } catch {
    return {};
  }
}

export function writeGlobalConfig(config: StoredConfig): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export function setConfigValue(key: string, value: unknown): void {
  const current = readGlobalConfig();
  (current as Record<string, unknown>)[key] = value;
  writeGlobalConfig(current);
}

export function getConfigValue(key: string): unknown {
  const current = readGlobalConfig();
  return (current as Record<string, unknown>)[key];
}

export function readProjectConfig(cwd: string): StoredConfig {
  const projectConfigFile = join(cwd, '.openaicli.json');
  if (!existsSync(projectConfigFile)) return {};
  try {
    const raw = readFileSync(projectConfigFile, 'utf-8');
    return JSON.parse(raw) as StoredConfig;
  } catch {
    return {};
  }
}
