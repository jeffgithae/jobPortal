import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  CandidateProfile,
  IngestionSummary,
  JobMatch,
  JobSource,
  PaginatedResult,
  SourceCatalogEntry,
} from '../models/job-portal.models';

interface RuntimeJobPortalConfig {
  apiBaseUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class JobPortalApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = this.resolveBaseUrl();

  getProfile() {
    return firstValueFrom(this.http.get<CandidateProfile>(`${this.baseUrl}/profile`));
  }

  getJobs(page: number, pageSize: number, realOnly = false) {
    return firstValueFrom(
      this.http.get<PaginatedResult<JobMatch>>(`${this.baseUrl}/jobs`, {
        params: {
          page,
          pageSize,
          realOnly,
        },
      }),
    );
  }

  getMatches(threshold: number, page: number, pageSize: number, realOnly = false) {
    return firstValueFrom(
      this.http.get<PaginatedResult<JobMatch>>(`${this.baseUrl}/jobs/matches`, {
        params: {
          threshold,
          page,
          pageSize,
          realOnly,
        },
      }),
    );
  }

  getSources() {
    return firstValueFrom(this.http.get<JobSource[]>(`${this.baseUrl}/jobs/sources`));
  }

  getSourceCatalog() {
    return firstValueFrom(this.http.get<SourceCatalogEntry[]>(`${this.baseUrl}/jobs/source-catalog`));
  }

  runIngestion() {
    return firstValueFrom(this.http.post<IngestionSummary>(`${this.baseUrl}/jobs/ingest/run`, {}));
  }

  uploadResume(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return firstValueFrom(this.http.post<CandidateProfile>(`${this.baseUrl}/profile/resume/upload`, formData));
  }

  private resolveBaseUrl() {
    if (typeof window === 'undefined') {
      return 'http://localhost:3001/api';
    }

    const runtimeWindow = window as Window & {
      __JOB_PORTAL_CONFIG__?: RuntimeJobPortalConfig;
    };
    const runtimeBaseUrl = runtimeWindow.__JOB_PORTAL_CONFIG__?.apiBaseUrl?.trim();

    if (runtimeBaseUrl) {
      return runtimeBaseUrl.replace(/\/$/, '');
    }

    return 'http://localhost:3001/api';
  }
}
