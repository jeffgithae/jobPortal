import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  AppUser,
  AuthSession,
  CandidateProfile,
  IngestionSummary,
  JobFilters,
  JobMatch,
  JobSource,
  JobUserTag,
  PaginatedResult,
  SourceCatalogEntry,
} from './models/job-portal.models';
import { JobPortalApiService } from './services/job-portal-api.service';

type WorkspaceView = 'dashboard' | 'tagged';

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
  private readonly sessionStorageKey = 'job-portal-session-token';
  readonly employmentTypeOptions = ['Full-time', 'Contract', 'Part-time', 'Internship'];
  readonly tagOptions: JobUserTag[] = ['interested', 'applied', 'saved', 'not-interested'];

  readonly authUser = signal<AppUser | null>(null);
  readonly sessionToken = signal<string | null>(this.readStoredSessionToken());
  readonly profile = signal<CandidateProfile | null>(null);
  readonly jobsPage = signal<PaginatedResult<JobMatch> | null>(null);
  readonly matchesPage = signal<PaginatedResult<JobMatch> | null>(null);
  readonly taggedJobsPage = signal<PaginatedResult<JobMatch> | null>(null);
  readonly sources = signal<JobSource[]>([]);
  readonly sourceCatalog = signal<SourceCatalogEntry[]>([]);
  readonly ingestionSummary = signal<IngestionSummary | null>(null);
  readonly threshold = signal(85);
  readonly selectedFile = signal<File | null>(null);
  readonly isLoading = signal(true);
  readonly isRefreshing = signal(false);
  readonly isUploading = signal(false);
  readonly isAuthenticating = signal(false);
  readonly isSavingPreferences = signal(false);
  readonly taggingJobId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly jobsPageNumber = signal(1);
  readonly matchesPageNumber = signal(1);
  readonly taggedJobsPageNumber = signal(1);
  readonly activeWorkspacePage = signal<WorkspaceView>('dashboard');
  readonly taggedTagFilter = signal<JobUserTag | ''>('');
  readonly searchFilter = signal('');
  readonly remoteOnlyFilter = signal(false);
  readonly employmentTypeFilter = signal('');
  readonly sourceTypeFilter = signal('');
  readonly locationFilter = signal('');
  readonly preferredLocationsDraft = signal('');
  readonly remotePreference = signal(false);
  readonly hybridPreference = signal(false);
  readonly onsitePreference = signal(false);

  readonly isAuthenticated = computed(() => Boolean(this.sessionToken() && this.authUser()));
  readonly jobs = computed(() => this.jobsPage()?.items ?? []);
  readonly matches = computed(() => this.matchesPage()?.items ?? []);
  readonly taggedJobs = computed(() => this.taggedJobsPage()?.items ?? []);
  readonly recommendedCount = computed(() => this.matchesPage()?.total ?? 0);
  readonly taggedJobsCount = computed(() => this.taggedJobsPage()?.total ?? 0);
  readonly strongestMatch = computed(() => this.matches()[0] ?? null);
  readonly enabledSources = computed(() => this.sources().filter((source) => source.enabled));
  readonly readyCatalogEntries = computed(() => this.sourceCatalog().filter((entry) => entry.status === 'ready' || entry.status === 'next'));
  readonly blockedCatalogEntries = computed(() => this.sourceCatalog().filter((entry) => entry.status === 'avoid'));
  readonly liveJobsCount = computed(() => this.jobsPage()?.total ?? 0);
  readonly activeFiltersCount = computed(() =>
    [
      this.searchFilter().trim(),
      this.remoteOnlyFilter() ? 'remote' : '',
      this.employmentTypeFilter().trim(),
      this.sourceTypeFilter().trim(),
      this.locationFilter().trim(),
    ].filter(Boolean).length,
  );
  readonly sourceTypeOptions = computed(() =>
    [...new Set(this.enabledSources().map((source) => source.type).filter((type) => type !== 'mock-curated'))].sort(),
  );

  constructor() {
    if (this.sessionToken()) {
      void this.bootstrapAuthenticatedApp();
    } else {
      this.isLoading.set(false);
    }
  }

  async login(emailInput: HTMLInputElement, passwordInput: HTMLInputElement) {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      this.error.set('Enter your email and password to continue.');
      return;
    }

    this.error.set(null);
    this.isAuthenticating.set(true);

    try {
      const session = await this.api.login(email, password);
      emailInput.value = '';
      passwordInput.value = '';
      await this.completeLogin(session);
    } catch (error) {
      this.error.set(this.getErrorMessage(error));
    } finally {
      this.isAuthenticating.set(false);
    }
  }

  async register(nameInput: HTMLInputElement, emailInput: HTMLInputElement, passwordInput: HTMLInputElement) {
    const displayName = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!displayName || !email || !password) {
      this.error.set('Name, email, and password are required to create an account.');
      return;
    }

    this.error.set(null);
    this.isAuthenticating.set(true);

    try {
      const session = await this.api.register(displayName, email, password);
      nameInput.value = '';
      emailInput.value = '';
      passwordInput.value = '';
      await this.completeLogin(session);
    } catch (error) {
      this.error.set(this.getErrorMessage(error));
    } finally {
      this.isAuthenticating.set(false);
    }
  }

  async logout() {
    const sessionToken = this.sessionToken();

    try {
      if (sessionToken) {
        await this.api.logout(sessionToken);
      }
    } catch {
      // Ignore logout API errors and clear local session regardless.
    }

    this.clearSession();
  }

  async loadDashboard() {
    const sessionToken = this.requireSessionToken();
    this.error.set(null);
    this.isLoading.set(true);

    try {
      const [profile, sources, sourceCatalog] = await Promise.all([
        this.api.getProfile(sessionToken),
        this.api.getSources(sessionToken),
        this.api.getSourceCatalog(sessionToken),
      ]);

      this.profile.set(profile);
      this.sources.set(sources);
      this.sourceCatalog.set(sourceCatalog);
      this.syncPreferenceDraft(profile);

      if (this.sourceTypeFilter() && !this.sourceTypeOptions().includes(this.sourceTypeFilter())) {
        this.sourceTypeFilter.set('');
      }

      await Promise.all([this.loadJobsPage(), this.loadMatchesPage(), this.loadTaggedJobsPage()]);
    } catch (error) {
      this.error.set(this.getErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  async runIngestion() {
    const sessionToken = this.requireSessionToken();
    this.error.set(null);
    this.isRefreshing.set(true);

    try {
      const summary = await this.api.runIngestion(sessionToken);
      this.ingestionSummary.set(summary);
      this.jobsPageNumber.set(1);
      this.matchesPageNumber.set(1);
      this.taggedJobsPageNumber.set(1);
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
    this.jobsPageNumber.set(1);

    try {
      await Promise.all([this.loadJobsPage(), this.loadMatchesPage()]);
    } catch (error) {
      this.error.set(this.getErrorMessage(error));
    }
  }

  async applyFilters() {
    this.error.set(null);
    this.jobsPageNumber.set(1);
    this.matchesPageNumber.set(1);

    try {
      await Promise.all([this.loadJobsPage(), this.loadMatchesPage()]);
    } catch (error) {
      this.error.set(this.getErrorMessage(error));
    }
  }

  async resetFilters() {
    this.searchFilter.set('');
    this.remoteOnlyFilter.set(false);
    this.employmentTypeFilter.set('');
    this.sourceTypeFilter.set('');
    this.locationFilter.set('');
    await this.applyFilters();
  }

  setWorkspacePage(view: WorkspaceView) {
    this.activeWorkspacePage.set(view);
  }

  async setTaggedFilter(tag: JobUserTag | '') {
    this.taggedTagFilter.set(tag);
    this.taggedJobsPageNumber.set(1);
    await this.loadTaggedJobsPage();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedFile.set(input.files?.[0] ?? null);
  }

  async uploadResume() {
    const sessionToken = this.requireSessionToken();
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
      const result = await this.api.syncResume(sessionToken, file);
      this.profile.set(result.profile);
      this.ingestionSummary.set(result.ingestionSummary);
      this.jobsPageNumber.set(1);
      this.matchesPageNumber.set(1);
      this.taggedJobsPageNumber.set(1);
      this.selectedFile.set(null);
      this.syncPreferenceDraft(result.profile);
      await this.loadDashboard();
    } catch (error) {
      this.error.set(this.getErrorMessage(error));
    } finally {
      this.isUploading.set(false);
    }
  }

  async savePreferences() {
    const sessionToken = this.requireSessionToken();
    const preferredLocations = this.preferredLocationsDraft()
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    const workPreferences = [
      this.remotePreference() ? 'remote' : '',
      this.hybridPreference() ? 'hybrid' : '',
      this.onsitePreference() ? 'onsite' : '',
    ].filter(Boolean);

    this.error.set(null);
    this.isSavingPreferences.set(true);

    try {
      const profile = await this.api.updateProfile(sessionToken, {
        preferredLocations,
        workPreferences,
      });
      this.profile.set(profile);
      await this.api.rescoreMatches(sessionToken);
      this.jobsPageNumber.set(1);
      this.matchesPageNumber.set(1);
      this.taggedJobsPageNumber.set(1);
      await this.loadDashboard();
    } catch (error) {
      this.error.set(this.getErrorMessage(error));
    } finally {
      this.isSavingPreferences.set(false);
    }
  }

  async toggleJobTag(job: JobMatch, tag: JobUserTag) {
    const sessionToken = this.requireSessionToken();
    const matchId = this.getMatchId(job);

    if (!matchId) {
      this.error.set('This job cannot be tagged because it does not have a stored match id yet.');
      return;
    }

    this.error.set(null);
    this.taggingJobId.set(matchId);

    try {
      const nextTag = job.userTag === tag ? null : tag;
      await this.api.updateJobTag(sessionToken, matchId, nextTag);
      await Promise.all([this.loadJobsPage(), this.loadMatchesPage(), this.loadTaggedJobsPage()]);
    } catch (error) {
      this.error.set(this.getErrorMessage(error));
    } finally {
      this.taggingJobId.set(null);
    }
  }

  async clearJobTag(job: JobMatch) {
    const sessionToken = this.requireSessionToken();
    const matchId = this.getMatchId(job);

    if (!matchId) {
      this.error.set('This job cannot be updated because it does not have a stored match id yet.');
      return;
    }

    this.error.set(null);
    this.taggingJobId.set(matchId);

    try {
      await this.api.updateJobTag(sessionToken, matchId, null);
      await Promise.all([this.loadJobsPage(), this.loadMatchesPage(), this.loadTaggedJobsPage()]);
    } catch (error) {
      this.error.set(this.getErrorMessage(error));
    } finally {
      this.taggingJobId.set(null);
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

  async goToTaggedJobsPage(page: number) {
    const totalPages = this.taggedJobsPage()?.totalPages ?? 0;

    if (page < 1 || (totalPages > 0 && page > totalPages)) {
      return;
    }

    this.taggedJobsPageNumber.set(page);
    await this.loadTaggedJobsPage();
  }

  isTagging(job: JobMatch) {
    return this.taggingJobId() === this.getMatchId(job);
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

  trackByTag(_: number, item: JobUserTag) {
    return item;
  }

  formatSourceType(type: string) {
    switch (type) {
      case 'greenhouse-board':
        return 'Greenhouse';
      case 'lever-postings':
        return 'Lever';
      case 'ashby-board':
        return 'Ashby';
      case 'djinni-search':
        return 'Djinni';
      default:
        return type;
    }
  }

  formatJobTag(tag?: JobUserTag) {
    switch (tag) {
      case 'interested':
        return 'Interested';
      case 'applied':
        return 'Applied';
      case 'saved':
        return 'Saved';
      case 'not-interested':
        return 'Not interested';
      default:
        return 'Untagged';
    }
  }

  private async bootstrapAuthenticatedApp() {
    const sessionToken = this.sessionToken();

    if (!sessionToken) {
      this.isLoading.set(false);
      return;
    }

    try {
      const session = await this.api.getCurrentUser(sessionToken);
      this.authUser.set(session.user);
      await this.loadDashboard();
    } catch {
      this.clearSession();
      this.error.set('Your session expired. Sign in again to continue.');
    }
  }

  private async completeLogin(session: AuthSession) {
    if (!session.session?.token) {
      this.error.set('Unable to create a session for this account.');
      return;
    }

    this.setSession(session.session.token, session.user);
    this.jobsPageNumber.set(1);
    this.matchesPageNumber.set(1);
    this.taggedJobsPageNumber.set(1);
    this.selectedFile.set(null);
    this.ingestionSummary.set(null);
    this.activeWorkspacePage.set('dashboard');
    this.taggedTagFilter.set('');
    await this.loadDashboard();
  }

  private loadJobsPage() {
    const sessionToken = this.requireSessionToken();
    return this.api
      .getJobs(sessionToken, this.jobsPageNumber(), this.pageSize, this.buildFilters())
      .then((page) => this.jobsPage.set(page));
  }

  private loadMatchesPage() {
    const sessionToken = this.requireSessionToken();
    return this.api
      .getMatches(sessionToken, this.threshold(), this.matchesPageNumber(), this.pageSize, this.buildFilters())
      .then((page) => this.matchesPage.set(page));
  }

  private loadTaggedJobsPage() {
    const sessionToken = this.requireSessionToken();
    return this.api
      .getTaggedJobs(sessionToken, this.taggedJobsPageNumber(), this.pageSize, this.taggedTagFilter())
      .then((page) => this.taggedJobsPage.set(page));
  }

  private buildFilters(): JobFilters {
    return {
      search: this.searchFilter(),
      remoteOnly: this.remoteOnlyFilter(),
      employmentType: this.employmentTypeFilter(),
      sourceType: this.sourceTypeFilter(),
      location: this.locationFilter(),
      excludeThreshold: this.threshold(),
    };
  }

  private syncPreferenceDraft(profile: CandidateProfile) {
    const workPreferences = new Set((profile.workPreferences ?? []).map((entry) => entry.toLowerCase()));
    this.preferredLocationsDraft.set((profile.preferredLocations ?? []).join(', '));
    this.remotePreference.set(workPreferences.has('remote'));
    this.hybridPreference.set(workPreferences.has('hybrid'));
    this.onsitePreference.set(workPreferences.has('onsite'));
  }

  private getMatchId(job: JobMatch) {
    return job.id ?? job._id ?? null;
  }

  private isSupportedResumeFile(file: File) {
    const fileName = file.name.toLowerCase();
    return file.type === 'application/pdf' || file.type === 'text/plain' || fileName.endsWith('.pdf') || fileName.endsWith('.txt');
  }

  private requireSessionToken() {
    const sessionToken = this.sessionToken();

    if (!sessionToken) {
      throw new Error('Sign in to continue.');
    }

    return sessionToken;
  }

  private setSession(sessionToken: string, user: AppUser) {
    this.sessionToken.set(sessionToken);
    this.authUser.set(user);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(this.sessionStorageKey, sessionToken);
    }
  }

  private clearSession() {
    this.sessionToken.set(null);
    this.authUser.set(null);
    this.profile.set(null);
    this.jobsPage.set(null);
    this.matchesPage.set(null);
    this.taggedJobsPage.set(null);
    this.sources.set([]);
    this.sourceCatalog.set([]);
    this.ingestionSummary.set(null);
    this.selectedFile.set(null);
    this.jobsPageNumber.set(1);
    this.matchesPageNumber.set(1);
    this.taggedJobsPageNumber.set(1);
    this.activeWorkspacePage.set('dashboard');
    this.taggedTagFilter.set('');
    this.searchFilter.set('');
    this.remoteOnlyFilter.set(false);
    this.employmentTypeFilter.set('');
    this.sourceTypeFilter.set('');
    this.locationFilter.set('');
    this.preferredLocationsDraft.set('');
    this.remotePreference.set(false);
    this.hybridPreference.set(false);
    this.onsitePreference.set(false);
    this.taggingJobId.set(null);
    this.isLoading.set(false);

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(this.sessionStorageKey);
    }
  }

  private readStoredSessionToken() {
    if (typeof window === 'undefined') {
      return null;
    }

    return window.localStorage.getItem(this.sessionStorageKey);
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
