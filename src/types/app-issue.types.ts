export interface AppIssueDto {
  id: number;
  title?: string | null;
  description?: string | null;
  severity?: string | null;
  type?: string | null;
  status?: string | null;
  pageUrl?: string | null;
  reportedById?: number;
  reportedByName?: string | null;
  createdAt?: string;
  resolvedById?: number | null;
  resolvedByName?: string | null;
  resolvedAt?: string | null;
  resolutionNotes?: string | null;
  originalFileName?: string | null;
  hasAttachment?: boolean;
}

export interface CreateAppIssueDto {
  title: string;
  description: string;
  severity?: string;
  type?: string;
  pageUrl?: string | null;
  userAgent?: string | null;
  fileName?: string | null;
  fileBuffer?: Buffer;
  contentType?: string | null;
  mimeType?: string | null;
}

export interface UpdateAppIssueStatusDto {
  status: string;
  resolutionNotes?: string | null;
}

export interface AppIssueFilterParams {
  status?: string;
  severity?: string;
  reportedById?: number;
  type?: string;
}
