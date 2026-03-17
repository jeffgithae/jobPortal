import { BadRequestException, Injectable } from '@nestjs/common';
import axios from 'axios';
import { JobSourceDocument } from '../schemas/job-source.schema';
import { JobIntelligenceService } from '../services/job-intelligence.service';
import { JobSourceAdapter, NormalizedJobListing } from './job-source-adapter.interface';

type DjinniJobPosting = {
  title?: string;
  description?: string;
  datePosted?: string;
  employmentType?: string | string[];
  hiringOrganization?: {
    name?: string;
  };
  jobLocation?:
    | {
        address?: {
          addressLocality?: string;
          addressRegion?: string;
          addressCountry?: string;
        };
      }
    | Array<{
        address?: {
          addressLocality?: string;
          addressRegion?: string;
          addressCountry?: string;
        };
      }>;
  jobLocationType?: string;
  applicantLocationRequirements?: unknown;
};

@Injectable()
export class DjinniSearchAdapter implements JobSourceAdapter {
  readonly type = 'djinni-search' as const;

  constructor(private readonly jobIntelligenceService: JobIntelligenceService) {}

  async fetchJobs(source: JobSourceDocument): Promise<NormalizedJobListing[]> {
    const listingUrl = source.config?.listingUrl;

    if (typeof listingUrl !== 'string' || !listingUrl.trim()) {
      throw new BadRequestException('Djinni source requires a listingUrl in config.');
    }

    const pages = this.clampNumber(source.config?.pages, 1, 1, 4);
    const maxJobs = this.clampNumber(source.config?.maxJobs, 30, 1, 60);
    const listingPages = Array.from({ length: pages }, (_, index) => this.buildListingUrl(listingUrl, index + 1));
    const pageHtml = await Promise.all(
      listingPages.map((url) =>
        axios
          .get<string>(url, {
            timeout: 20000,
            headers: {
              'user-agent': 'Mozilla/5.0 (compatible; JobPortalBot/1.0; +https://jobportal.local)',
            },
          })
          .then((response) => response.data),
      ),
    );

    const detailUrls = [...new Set(pageHtml.flatMap((html) => this.extractJobUrls(html, listingUrl)))].slice(0, maxJobs);
    const results = await Promise.all(detailUrls.map((url) => this.fetchJobDetail(url, source)));
    return results.filter((job): job is NormalizedJobListing => Boolean(job));
  }

  private async fetchJobDetail(url: string, source: JobSourceDocument): Promise<NormalizedJobListing | null> {
    try {
      const { data: html } = await axios.get<string>(url, {
        timeout: 20000,
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; JobPortalBot/1.0; +https://jobportal.local)',
        },
      });
      const jobPosting = this.extractJobPostingJsonLd(html);
      const title = this.firstNonEmpty(jobPosting?.title, this.extractMetaContent(html, 'og:title'), this.extractTitleTag(html));

      if (!title) {
        return null;
      }

      const description = this.firstNonEmpty(
        typeof jobPosting?.description === 'string' ? jobPosting.description : undefined,
        this.extractMetaContent(html, 'og:description'),
      );
      const location = this.extractLocation(jobPosting, description);
      const employmentType = this.normalizeEmploymentType(jobPosting?.employmentType);
      const company = this.firstNonEmpty(jobPosting?.hiringOrganization?.name, typeof source.config?.company === 'string' ? source.config.company : undefined, source.name) ?? source.name;
      const plainDescription = this.jobIntelligenceService.toPlainText(description ?? title);
      const remote =
        /remote/i.test(jobPosting?.jobLocationType ?? '') ||
        /remote/i.test(this.stringifyUnknown(jobPosting?.applicantLocationRequirements)) ||
        this.jobIntelligenceService.inferRemote(location, plainDescription);
      const normalizedUrl = new URL(url).toString();

      return {
        externalId: new URL(url).pathname.replace(/\/+$/, ''),
        title,
        company,
        location,
        remote,
        employmentType,
        url: normalizedUrl,
        description: plainDescription,
        requirements: [],
        skills: this.jobIntelligenceService.extractSkills(title, plainDescription),
        minExperienceYears: this.jobIntelligenceService.extractYearsExperience(plainDescription),
        seniority: this.jobIntelligenceService.inferSeniority(title, plainDescription),
        postedAt: jobPosting?.datePosted ? new Date(jobPosting.datePosted) : undefined,
        raw: {
          sourceUrl: normalizedUrl,
          hasStructuredData: Boolean(jobPosting),
        },
      };
    } catch {
      return null;
    }
  }

  private buildListingUrl(listingUrl: string, page: number) {
    const url = new URL(listingUrl);

    if (page > 1) {
      url.searchParams.set('page', String(page));
    }

    return url.toString();
  }

  private extractJobUrls(html: string, baseUrl: string) {
    const matches = html.matchAll(/href=(['"])(?<href>(?:https:\/\/djinni\.co)?\/jobs\/[^'"?#]*\d[^'"?#]*)\1/gi);
    const urls: string[] = [];

    for (const match of matches) {
      const href = match.groups?.href;

      if (!href) {
        continue;
      }

      try {
        const absoluteUrl = new URL(href, baseUrl).toString();

        if (!absoluteUrl.includes('/jobs/')) {
          continue;
        }

        urls.push(absoluteUrl);
      } catch {
        // Ignore malformed listing URLs.
      }
    }

    return urls;
  }

  private extractJobPostingJsonLd(html: string) {
    const scriptMatches = html.matchAll(/<script[^>]+type=['"]application\/ld\+json['"][^>]*>([\s\S]*?)<\/script>/gi);

    for (const match of scriptMatches) {
      const payload = match[1]?.trim();

      if (!payload) {
        continue;
      }

      try {
        const parsed = JSON.parse(this.decodeHtmlEntities(payload));
        const jobPosting = this.findJobPosting(parsed);

        if (jobPosting) {
          return jobPosting as DjinniJobPosting;
        }
      } catch {
        // Ignore invalid structured data blocks.
      }
    }

    return null;
  }

  private findJobPosting(payload: unknown): unknown {
    if (Array.isArray(payload)) {
      for (const entry of payload) {
        const nested = this.findJobPosting(entry);

        if (nested) {
          return nested;
        }
      }

      return null;
    }

    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const record = payload as Record<string, unknown>;
    const type = record['@type'];

    if (type === 'JobPosting') {
      return record;
    }

    for (const value of Object.values(record)) {
      const nested = this.findJobPosting(value);

      if (nested) {
        return nested;
      }
    }

    return null;
  }

  private extractMetaContent(html: string, property: string) {
    const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`<meta[^>]+property=['\"]${escapedProperty}['\"][^>]+content=['\"]([\\s\\S]*?)['\"][^>]*>`, 'i'),
      new RegExp(`<meta[^>]+content=['\"]([\\s\\S]*?)['\"][^>]+property=['\"]${escapedProperty}['\"][^>]*>`, 'i'),
      new RegExp(`<meta[^>]+name=['\"]${escapedProperty}['\"][^>]+content=['\"]([\\s\\S]*?)['\"][^>]*>`, 'i'),
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);

      if (match?.[1]) {
        return this.decodeHtmlEntities(match[1]);
      }
    }

    return undefined;
  }

  private extractTitleTag(html: string) {
    const match = html.match(/<title>([\s\S]*?)<\/title>/i);
    return match?.[1] ? this.decodeHtmlEntities(match[1].replace(/\s*[-|–].*$/, '').trim()) : undefined;
  }

  private extractLocation(jobPosting: DjinniJobPosting | null, description?: string) {
    const locations = Array.isArray(jobPosting?.jobLocation) ? jobPosting?.jobLocation : jobPosting?.jobLocation ? [jobPosting.jobLocation] : [];
    const normalizedLocations = locations
      .map((location) => {
        const address = location?.address;
        return [address?.addressLocality, address?.addressRegion, address?.addressCountry].filter(Boolean).join(', ');
      })
      .filter(Boolean);

    if (normalizedLocations.length > 0) {
      return normalizedLocations[0];
    }

    if (/remote/i.test(jobPosting?.jobLocationType ?? '') || /remote/i.test(this.stringifyUnknown(jobPosting?.applicantLocationRequirements))) {
      return 'Remote';
    }

    if (description && /remote/i.test(description)) {
      return 'Remote';
    }

    return undefined;
  }

  private normalizeEmploymentType(employmentType?: string | string[]) {
    if (Array.isArray(employmentType)) {
      return employmentType.filter(Boolean).join(', ');
    }

    return employmentType;
  }

  private firstNonEmpty(...values: Array<string | undefined>) {
    return values.find((value) => typeof value === 'string' && value.trim())?.trim();
  }

  private clampNumber(value: unknown, fallback: number, min: number, max: number) {
    const numeric = Number(value);

    if (!Number.isFinite(numeric)) {
      return fallback;
    }

    return Math.min(max, Math.max(min, Math.trunc(numeric)));
  }

  private decodeHtmlEntities(value: string) {
    return value
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#x2F;/gi, '/');
  }

  private stringifyUnknown(value: unknown) {
    if (typeof value === 'string') {
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
}

