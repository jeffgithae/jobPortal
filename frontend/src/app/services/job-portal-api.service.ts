import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AuthSession,
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

  register(displayName: string, email: string, password: string) {
    return firstValueFrom(
      this.http.post<AuthSession>(`${this.baseUrl}/auth/register`, { displayName, email, password }),
    );
  }

  login(email: string, password: string) {
    return firstValueFrom(this.http.post<AuthSession>(`${this.baseUrl}/auth/login`, { email, password }));
  }

  getCurrentUser(sessionToken: string) {
    return firstValueFrom(
      this.http.get<AuthSession>(`${this.baseUrl}/auth/me`, {
        headers: this.createAuthHeaders(sessionToken),
      }),
    );
  }

  logout(sessionToken: string) {
    return firstValueFrom(
      this.http.post<{ success: boolean }>(`${this.baseUrl}/auth/logout`, {}, {
        headers: this.createAuthHeaders(sessionToken),
      }),
    );
  }

  getProfile(sessionToken: string) {
    return firstValueFrom(
      this.http.get<CandidateProfile>(`${this.baseUrl}/profile`, {
        headers: this.createAuthHeaders(sessionToken),
      }),
    );
  }

  getJobs(sessionToken: string, page: number, pageSize: number, realOnly = false) {
    return firstValueFrom(
      this.http.get<PaginatedResult<JobMatch>>(`${this.baseUrl}/jobs`, {
        headers: this.createAuthHeaders(sessionToken),
        params: {
          page,
          pageSize,
          realOnly,
        },
      }),
    );
  }

  getMatches(sessionToken: string, threshold: number, page: number, pageSize: number, realOnly = false) {
    return firstValueFrom(
      this.http.get<PaginatedResult<JobMatch>>(`${this.baseUrl}/jobs/matches`, {
        headers: this.createAuthHeaders(sessionToken),
        params: {
          threshold,
          page,
          pageSize,
          realOnly,
        },
      }),
    );
  }

  getSources(sessionToken: string) {
    return firstValueFrom(
      this.http.get<JobSource[]>(`${this.baseUrl}/jobs/sources`, {
        headers: this.createAuthHeaders(sessionToken),
      }),
    );
  }

  getSourceCatalog(sessionToken: string) {
    return firstValueFrom(
      this.http.get<SourceCatalogEntry[]>(`${this.baseUrl}/jobs/source-catalog`, {
        headers: this.createAuthHeaders(sessionToken),
      }),
    );
  }

  runIngestion(sessionToken: string) {
    return firstValueFrom(
      this.http.post<IngestionSummary>(`${this.baseUrl}/jobs/ingest/run`, {}, {
        headers: this.createAuthHeaders(sessionToken),
      }),
    );
  }

  syncResume(sessionToken: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return firstValueFrom(
      this.http.post<ResumeSyncResult>(`${this.baseUrl}/jobs/resume-sync`, formData, {
        headers: this.createAuthHeaders(sessionToken),
      }),
    );
  }

  private createAuthHeaders(sessionToken: string) {
    return new HttpHeaders({
      Authorization: `Bearer ${sessionToken}`,
    });
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
