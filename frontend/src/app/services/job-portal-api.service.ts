import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  AppUser,
  CandidateProfile,
  IngestionSummary,
  JobMatch,
  JobSource,
  PaginatedResult,
  ResumeSyncResult,
  SourceCatalogEntry,
} from '../models/job-portal.models';

interface RuntimeJobPortalConfig {
  apiBaseUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class JobPortalApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = this.resolveBaseUrl();

  getUsers() {
    return firstValueFrom(this.http.get<AppUser[]>(`${this.baseUrl}/users`));
  }

  createUser(displayName: string, email: string) {
    return firstValueFrom(this.http.post<AppUser>(`${this.baseUrl}/users`, { displayName, email }));
  }

  getProfile(userKey: string) {
    return firstValueFrom(
      this.http.get<CandidateProfile>(`${this.baseUrl}/profile`, {
        params: {
          userKey,
        },
      }),
    );
  }

  getJobs(userKey: string, page: number, pageSize: number, realOnly = false) {
    return firstValueFrom(
      this.http.get<PaginatedResult<JobMatch>>(`${this.baseUrl}/jobs`, {
        params: {
          userKey,
          page,
          pageSize,
          realOnly,
        },
      }),
    );
  }

  getMatches(userKey: string, threshold: number, page: number, pageSize: number, realOnly = false) {
    return firstValueFrom(
      this.http.get<PaginatedResult<JobMatch>>(`${this.baseUrl}/jobs/matches`, {
        params: {
          userKey,
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

  runIngestion(userKey: string) {
    return firstValueFrom(
      this.http.post<IngestionSummary>(`${this.baseUrl}/jobs/ingest/run`, {}, {
        params: {
          userKey,
        },
      }),
    );
  }

  syncResume(userKey: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return firstValueFrom(
      this.http.post<ResumeSyncResult>(`${this.baseUrl}/jobs/resume-sync`, formData, {
        params: {
          userKey,
        },
      }),
    );
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
