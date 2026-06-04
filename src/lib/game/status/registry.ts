import type { StatusDefinition } from './types';
export const STATUS_REGISTRY = new Map<string, StatusDefinition>();
export function defineStatus(def: StatusDefinition): StatusDefinition {
  if (STATUS_REGISTRY.has(def.id)) throw new Error(`Duplicate status ${def.id}`);
  STATUS_REGISTRY.set(def.id, def);
  return def;
}
export function getStatusDef(id: string): StatusDefinition | undefined {
  return STATUS_REGISTRY.get(id);
}
