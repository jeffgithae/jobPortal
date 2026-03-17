import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  CandidateProfile,
  IngestionSummary,
  JobMatch,
  JobSource,
  PaginatedResult,
  SourceCatalogEntry,
} from './models/job-portal.models';
import { JobPortalApiService } from './services/job-portal-api.service';

@Component({
  selector: 'app-root',
  imports: [DatePipe],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly api = inject(JobPortalApiService);
  private readonly pageSize = 12;

  readonly profile = signal<CandidateProfile | null>(null);
  readonly jobsPage = signal<PaginatedResult<JobMatch> | null>(null);
  readonly matchesPage = signal<PaginatedResult<JobMatch> | null>(null);
  readonly sources = signal<JobSource[]>([]);
  readonly sourceCatalog = signal<SourceCatalogEntry[]>([]);
  readonly ingestionSummary = signal<IngestionSummary | null>(null);
  readonly threshold = signal(85);
  readonly selectedFile = signal<File | null>(null);
  readonly isLoading = signal(true);
  readonly isRefreshing = signal(false);
  readonly isUploading = signal(false);
  readonly error = signal<string | null>(null);
  readonly jobsPageNumber = signal(1);
  readonly matchesPageNumber = signal(1);

  readonly jobs = computed(() => this.jobsPage()?.items ?? []);
  readonly matches = computed(() => this.matchesPage()?.items ?? []);
  readonly recommendedCount = computed(() => this.matchesPage()?.total ?? 0);
  readonly strongestMatch = computed(() => this.matches()[0] ?? null);
  readonly enabledSources = computed(() => this.sources().filter((source) => source.enabled));
  readonly readyCatalogEntries = computed(() => this.sourceCatalog().filter((entry) => entry.status === 'ready' || entry.status === 'next'));
  readonly blockedCatalogEntries = computed(() => this.sourceCatalog().filter((entry) => entry.status === 'avoid'));
  readonly liveJobsCount = computed(() => this.jobsPage()?.total ?? 0);

  constructor() {
    void this.loadDashboard();
  }

  async loadDashboard() {
    this.error.set(null);
    this.isLoading.set(true);

    try {
      const [profile, sources, sourceCatalog] = await Promise.all([
        this.api.getProfile(),
        this.api.getSources(),
        this.api.getSourceCatalog(),
      ]);

      this.profile.set(profile);
      this.sources.set(sources);
      this.sourceCatalog.set(sourceCatalog);

      await Promise.all([this.loadJobsPage(), this.loadMatchesPage()]);
    } catch (error) {
      this.error.set(this.getErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  async runIngestion() {
    this.error.set(null);
    this.isRefreshing.set(true);

    try {
      const summary = await this.api.runIngestion();
      this.ingestionSummary.set(summary);
      this.jobsPageNumber.set(1);
      this.matchesPageNumber.set(1);
      await this.loadDashboard();
    } catch (error) {
      this.error.set(this.getErrorMessage(error));
    } finally {
      this.isRefreshing.set(false);
    }
  }

  async refreshMatchesForThreshold(value: string) {
    const threshold = Number(value);
    this.threshold.set(Number.isFinite(threshold) ? threshold : 85);
    this.matchesPageNumber.set(1);

    try {
      await this.loadMatchesPage();
    } catch (error) {
      this.error.set(this.getErrorMessage(error));
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedFile.set(input.files?.[0] ?? null);
  }

  async uploadResume() {
    const file = this.selectedFile();

    if (!file) {
      this.error.set('Select a PDF or plain-text resume before uploading.');
      return;
    }

    if (!this.isSupportedResumeFile(file)) {
      this.error.set('Unsupported resume file. Upload a PDF or plain-text (.txt) resume.');
      return;
    }

    this.error.set(null);
    this.isUploading.set(true);

    try {
      const profile = await this.api.uploadResume(file);
      this.profile.set(profile);
      await this.runIngestion();
    } catch (error) {
      this.error.set(this.getErrorMessage(error));
    } finally {
      this.isUploading.set(false);
    }
  }

  async goToJobsPage(page: number) {
    const totalPages = this.jobsPage()?.totalPages ?? 0;

    if (page < 1 || (totalPages > 0 && page > totalPages)) {
      return;
    }

    this.jobsPageNumber.set(page);
    await this.loadJobsPage();
  }

  async goToMatchesPage(page: number) {
    const totalPages = this.matchesPage()?.totalPages ?? 0;

    if (page < 1 || (totalPages > 0 && page > totalPages)) {
      return;
    }

    this.matchesPageNumber.set(page);
    await this.loadMatchesPage();
  }

  trackByTitle(_: number, item: JobMatch) {
    return item.id ?? item._id ?? `${item.company}-${item.title}`;
  }

  trackBySource(_: number, item: JobSource) {
    return item.id ?? item._id ?? `${item.type}-${item.name}`;
  }

  trackByCatalog(_: number, item: SourceCatalogEntry) {
    return item.key;
  }

  private loadJobsPage() {
    return this.api
      .getJobs(this.jobsPageNumber(), this.pageSize, true)
      .then((page) => this.jobsPage.set(page));
  }

  private loadMatchesPage() {
    return this.api
      .getMatches(this.threshold(), this.matchesPageNumber(), this.pageSize, true)
      .then((page) => this.matchesPage.set(page));
  }

  private isSupportedResumeFile(file: File) {
    const fileName = file.name.toLowerCase();
    return file.type === 'application/pdf' || file.type === 'text/plain' || fileName.endsWith('.pdf') || fileName.endsWith('.txt');
  }

  private getErrorMessage(error: unknown) {
    if (typeof error === 'object' && error) {
      const errorWithPayload = error as {
        error?: { message?: string | string[] };
        message?: string;
      };
      const payloadMessage = errorWithPayload.error?.message;

      if (Array.isArray(payloadMessage)) {
        return payloadMessage.join(', ');
      }

      if (typeof payloadMessage === 'string' && payloadMessage.trim()) {
        return payloadMessage;
      }

      if (typeof errorWithPayload.message === 'string' && errorWithPayload.message.trim()) {
        return errorWithPayload.message;
      }
    }

    return 'The dashboard could not reach the API. Start the Nest server and MongoDB, then refresh.';
  }
}
