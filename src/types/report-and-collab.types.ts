export interface StageCollaboratorDto {
  id?: number;
  responsibleId?: number;
  responsibleName?: string | null;
  registeredAt?: string;
}

export interface AddStageCollaboratorDto {
  responsibleId: number;
}

export interface DailyHoursPersonDto {
  responsibleId?: number;
  responsibleName?: string | null;
  serviceId?: number;
  serviceName?: string | null;
  hours?: number;
  activitiesCount?: number;
  dailyHours?: Record<string, number>;
}

export interface DailyHoursTotalDto {
  date?: string;
  totalHours?: number;
}

export interface DailyMissingCaptureDto {
  responsibleId?: number;
  responsibleName?: string | null;
  date?: string;
  missingHours?: number;
}

export interface DailyHoursReportDto {
  startDate?: string;
  endDate?: string;
  today?: string;
  hoursPerDay?: number;
  people?: DailyHoursPersonDto[] | null;
  totals?: DailyHoursTotalDto[] | null;
  missingCaptureDate?: string | null;
  missingCapture?: DailyMissingCaptureDto[] | null;
}

export interface PersonCapacityDto {
  responsibleId?: number;
  responsibleName?: string | null;
  position?: string | null;
  monthlyCapacity?: number;
  weeklyCapacityTarget?: number;
  hoursAssigned?: number;
  hoursExecuted?: number;
  utilizationRate?: number;
}

export interface CapacitySummaryDto {
  totalPeople?: number;
  totalMonthlyCapacity?: number;
  totalHoursExecuted?: number;
  averageUtilizationRate?: number;
}

export interface CapacityWorkloadReportDto {
  year?: number;
  month?: number;
  monthName?: string | null;
  projectId?: number | null;
  projectName?: string | null;
  personCapacities?: PersonCapacityDto[] | null;
  summary?: CapacitySummaryDto | null;
}

export interface ProjectRepositoryDto {
  id?: number;
  projectId?: number;
  name?: string | null;
  repositoryUrl?: string | null;
  provider?: string | null;
  defaultBranch?: string | null;
  lastSyncAt?: string | null;
  cicdInfo?: any;
}
