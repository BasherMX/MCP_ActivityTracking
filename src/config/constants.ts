/**
 * Constantes y Definiciones de Tipos del Sistema.
 * NOTA DE ARQUITECTURA: Todos los catálogos de Proyectos, Servicios, Productos
 * y Sprints se leen DINÁMICAMENTE desde la API en tiempo real para adaptarse
 * a la evolución del sistema sin requerir valores duros en código.
 */

export interface ProjectCatalogItem {
  id: number;
  name: string;
  prefix?: string;
  active?: boolean;
}

export interface ServiceCatalogItem {
  id: number;
  name: string;
  externalKey?: string;
}

export const FALLBACK_ACTIVITY_TYPES = [
  'Development',
  'Maintenance',
  'Planning',
  'Support',
  'Operational',
  'Desing', // Ortografía oficial del backend
  'Analysis',
  'Review',
  'Training',
] as const;

export type ActivityType = (typeof FALLBACK_ACTIVITY_TYPES)[number] | string;

export const FALLBACK_ACTIVITY_STATUSES = [
  'Pending',
  'InProgress',
  'Completed',
  'Cancelled',
] as const;

export type ActivityStatus = (typeof FALLBACK_ACTIVITY_STATUSES)[number] | string;

export const FALLBACK_ACTIVITY_PRIORITIES = [
  'Low',
  'Medium',
  'High',
] as const;

export type ActivityPriority = (typeof FALLBACK_ACTIVITY_PRIORITIES)[number] | string;
