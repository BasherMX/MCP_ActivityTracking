/**
 * Tipos TypeScript mapeados directamente desde la especificación OpenAPI (Activity-Tracking.json)
 */

export interface AuthenticateDto {
  username?: string | null;
  password?: string | null;
}

export interface ResponsibleServiceSummaryDto {
  serviceId?: number;
  serviceName?: string | null;
}

export interface ResponsibleDto {
  id: number;
  fullName?: string | null;
  active: boolean;
  position?: string | null;
  monthlyCapacity?: number | null;
  username?: string | null;
  hasPassword?: boolean;
  auditable?: boolean;
  token?: string | null;
  services?: ResponsibleServiceSummaryDto[] | null;
}

export interface CreateActivityDto {
  description?: string | null;
  status?: string | null;
  type?: string | null;
  priority?: string | null;
  progressPercentage?: number;
  registrationDate?: string | null;
  estimatedStartDate?: string | null;
  actualStartDate?: string | null;
  estimatedDeliveryDate?: string | null;
  actualCompletionDate?: string | null;
  estimatedHours?: number | null;
  notes?: string | null;
  support?: string | null;
  projectId?: number;
  responsibleId?: number;
  serviceId?: number;
  productApplicable?: boolean;
  productId?: number | null;
  sprintId?: number | null;
  isProposal?: boolean;
}

export interface UpdateActivityDto {
  description?: string | null;
  status?: string | null;
  type?: string | null;
  priority?: string | null;
  progressPercentage?: number;
  registrationDate?: string | null;
  estimatedStartDate?: string | null;
  actualStartDate?: string | null;
  estimatedDeliveryDate?: string | null;
  actualCompletionDate?: string | null;
  estimatedHours?: number | null;
  notes?: string | null;
  support?: string | null;
  projectId?: number;
  responsibleId?: number;
  serviceId?: number;
  productApplicable?: boolean;
  productId?: number | null;
  sprintId?: number | null;
}

export interface ActivityListDto {
  id: number;
  activityId?: string | null;
  description?: string | null;
  status?: string | null;
  type?: string | null;
  priority?: string | null;
  progressPercentage?: number;
  estimatedStartDate?: string | null;
  actualStartDate?: string | null;
  estimatedDeliveryDate?: string | null;
  actualCompletionDate?: string | null;
  projectName?: string | null;
  responsibleName?: string | null;
  productName?: string | null;
  serviceName?: string | null;
  isProposal?: boolean;
  proposedByName?: string | null;
  currentStageName?: string | null;
  hasActiveBlocker?: boolean;
  evidenceCount?: number;
  isSupport?: boolean;
  supportHours?: number;
}

export interface ActivityDto {
  id: number;
  activityId?: string | null;
  description?: string | null;
  status?: string | null;
  type?: string | null;
  priority?: string | null;
  progressPercentage?: number;
  registrationDate?: string | null;
  estimatedStartDate?: string | null;
  actualStartDate?: string | null;
  estimatedDeliveryDate?: string | null;
  actualCompletionDate?: string | null;
  estimatedHours?: number | null;
  actualHours?: number | null;
  notes?: string | null;
  support?: string | null;
  isProposal?: boolean;
  proposedById?: number | null;
  proposedByName?: string | null;
  approvedById?: number | null;
  approvedByName?: string | null;
  approvalDate?: string | null;
  projectId?: number;
  projectName?: string | null;
  responsibleId?: number;
  responsibleName?: string | null;
  responsibleEmail?: string | null;
  productApplicable?: boolean;
  productId?: number | null;
  productName?: string | null;
  serviceId?: number;
  serviceName?: string | null;
  sprintId?: number | null;
  currentStageId?: number | null;
  currentStageName?: string | null;
  currentStageOrder?: number | null;
  currentStageAssignedToName?: string | null;
}

export interface CreateStageWorkEntryDto {
  responsibleId?: number;
  workDate: string;
  hoursWorked: number;
  notes?: string | null;
}

export interface StageWorkEntryDto {
  id: number;
  stageProgressId: number;
  responsibleId: number;
  responsibleName?: string | null;
  workDate: string;
  hoursWorked: number;
  notes?: string | null;
  createdAt: string;
  isRetroactive?: boolean;
  retroactiveDays?: number;
  createdByUserId?: number;
  createdByName?: string | null;
  updatedAt?: string | null;
  updatedByUserId?: number | null;
  updatedByName?: string | null;
}

export interface AdHocStageProgressDto {
  id: number;
  activityId: number;
  stageId: number;
  stageName?: string | null;
  stageOrder?: number;
  isActive: boolean;
  startedAt?: string | null;
  completedAt?: string | null;
  actualHours?: number | null;
}

export interface WorkItemDto {
  id: number;
  title?: string | null;
  state?: string | null;
  workItemType?: string | null;
  assignedTo?: string | null;
  originalEstimate?: number | null;
  completedWork?: number | null;
  changedDate?: string | null;
  closedDate?: string | null;
  stateChangeDate?: string | null;
  attentionDate?: string | null;
  lastSyncDate?: string | null;
  tags?: string | null;
  severity?: string | null;
  gitLabIssueId?: number | null;
  gitLabIssueUrl?: string | null;
  gitLabIssueSyncDate?: string | null;
}

export interface MeetingSummaryDto {
  id: number;
  title?: string | null;
  scheduledDate?: string;
  durationMinutes?: number;
  type?: string | null;
  status?: string | null;
  location?: string | null;
  activityId?: number | null;
  activityKey?: string | null;
}

export interface ProjectDto {
  id: number;
  name?: string | null;
  prefix?: string | null;
  active: boolean;
  order?: number;
}

export interface ServiceDto {
  id: number;
  name?: string | null;
  externalKey?: string | null;
}

export interface ProductDto {
  id: number;
  name?: string | null;
  serviceId?: number | null;
  serviceName?: string | null;
  isProposal?: boolean;
  description?: string | null;
}

export interface ActivityEvidenceDto {
  id: number;
  activityId: number;
  fileName?: string | null;
  url?: string | null;
  description?: string | null;
  uploadedAt: string;
}

export interface CreateUrlEvidenceDto {
  url: string;
  description?: string | null;
}

export interface SprintSyncResultDto {
  created?: number;
  updated?: number;
  total?: number;
  message?: string | null;
}

export interface WorkItemSyncResultDto {
  created?: number;
  updated?: number;
  deleted?: number;
  skipped?: number;
  total?: number;
  message?: string | null;
}

export interface CatalogItemDto {
  id?: number;
  name?: string | null;
  displayName?: string | null;
}

