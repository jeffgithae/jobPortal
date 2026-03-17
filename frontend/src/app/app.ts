import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  AppUser,
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
  private readonly activeUserStorageKey = 'job-portal-active-user';

  readonly users = signal<AppUser[]>([]);
  readonly activeUserKey = signal(this.readStoredUserKey());
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
  readonly isCreatingUser = signal(false);
  readonly error = signal<string | null>(null);
  readonly jobsPageNumber = signal(1);
  readonly matchesPageNumber = signal(1);

  readonly selectedUser = computed(() => this.users().find((user) => user.ownerKey === this.activeUserKey()) ?? null);
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
      const [users, sources, sourceCatalog] = await Promise.all([
        this.api.getUsers(),
        this.api.getSources(),
        this.api.getSourceCatalog(),
      ]);

      this.users.set(users);
      this.sources.set(sources);
      this.sourceCatalog.set(sourceCatalog);

      const ownerKey = this.resolveActiveUserKey(users);
      this.setActiveUserKey(ownerKey);

      const [profile] = await Promise.all([
        this.api.getProfile(ownerKey),
        this.loadJobsPage(),
        this.loadMatchesPage(),
      ]);

      this.profile.set(profile);
    } catch (error) {
      this.error.set(this.getErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  async switchUser(userKey: string) {
    if (!userKey || userKey === this.activeUserKey()) {
      return;
    }

    this.jobsPageNumber.set(1);
    this.matchesPageNumber.set(1);
    this.selectedFile.set(null);
    this.ingestionSummary.set(null);
    this.setActiveUserKey(userKey);
    await this.loadDashboard();
  }

  async createUser(nameInput: HTMLInputElement, emailInput: HTMLInputElement) {
    const displayName = nameInput.value.trim();
    const email = emailInput.value.trim();

    if (!displayName || !email) {
      this.error.set('Provide both a display name and an email address to create a user workspace.');
      return;
    }

    this.error.set(null);
    this.isCreatingUser.set(true);

    try {
      const user = await this.api.createUser(displayName, email);
      this.users.set([...this.users(), user].sort((left, right) => left.displayName.localeCompare(right.displayName)));
      nameInput.value = '';
      emailInput.value = '';
      await this.switchUser(user.ownerKey);
    } catch (error) {
      this.error.set(this.getErrorMessage(error));
    } finally {
      this.isCreatingUser.set(false);
    }
  }

  async runIngestion() {
    this.error.set(null);
    this.isRefreshing.set(true);

    try {
      const summary = await this.api.runIngestion(this.activeUserKey());
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
      const result = await this.api.syncResume(this.activeUserKey(), file);
      this.profile.set(result.profile);
      this.ingestionSummary.set(result.ingestionSummary);
      this.jobsPageNumber.set(1);
      this.matchesPageNumber.set(1);
      this.selectedFile.set(null);
      await this.loadDashboard();
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
    return item.id ?? item._id ?? `${item.ownerKey}-${item.company}-${item.title}`;
  }

  trackBySource(_: number, item: JobSource) {
    return item.id ?? item._id ?? `${item.type}-${item.name}`;
  }

  trackByCatalog(_: number, item: SourceCatalogEntry) {
    return item.key;
  }

  trackByUser(_: number, item: AppUser) {
    return item.id ?? item._id ?? item.ownerKey;
  }

  private loadJobsPage() {
    return this.api
      .getJobs(this.activeUserKey(), this.jobsPageNumber(), this.pageSize, true)
      .then((page) => this.jobsPage.set(page));
  }

  private loadMatchesPage() {
    return this.api
      .getMatches(this.activeUserKey(), this.threshold(), this.matchesPageNumber(), this.pageSize, true)
      .then((page) => this.matchesPage.set(page));
  }

  private isSupportedResumeFile(file: File) {
    const fileName = file.name.toLowerCase();
    return file.type === 'application/pdf' || file.type === 'text/plain' || fileName.endsWith('.pdf') || fileName.endsWith('.txt');
  }

  private resolveActiveUserKey(users: AppUser[]) {
    const current = this.activeUserKey();

    if (current && users.some((user) => user.ownerKey === current)) {
      return current;
    }

    return users[0]?.ownerKey ?? 'starter-user';
  }

  private setActiveUserKey(userKey: string) {
    this.activeUserKey.set(userKey);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(this.activeUserStorageKey, userKey);
    }
  }

  private readStoredUserKey() {
    if (typeof window === 'undefined') {
      return 'starter-user';
    }

    return window.localStorage.getItem(this.activeUserStorageKey) ?? 'starter-user';
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
