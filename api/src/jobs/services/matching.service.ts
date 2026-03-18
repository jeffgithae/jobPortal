import { Injectable } from '@nestjs/common';
import { CandidateProfileDocument } from '../../candidate/schemas/candidate-profile.schema';
import { NormalizedJobListing } from '../source-adapters/job-source-adapter.interface';

type MatchBreakdown = {
  totalScore: number;
  isRecommended: boolean;
  isRelevant: boolean;
  reasons: string[];
  missingRequirements: string[];
};

const DOMAIN_STOP_WORDS = new Set([
  'about',
  'across',
  'ability',
  'aligned',
  'business',
  'candidate',
  'company',
  'current',
  'delivery',
  'digital',
  'direct',
  'enterprise',
  'experience',
  'focus',
  'great',
  'healthcare',
  'leading',
  'management',
  'manager',
  'office',
  'onsite',
  'people',
  'process',
  'product',
  'project',
  'remote',
  'required',
  'role',
  'software',
  'solution',
  'systems',
  'technical',
  'technology',
  'their',
  'through',
  'using',
  'years',
]);

@Injectable()
export class MatchingService {
  scoreJob(
    candidateProfile: CandidateProfileDocument,
    job: Pick<NormalizedJobListing, 'title' | 'description' | 'skills' | 'requirements' | 'location' | 'remote' | 'minExperienceYears' | 'seniority'>,
    threshold: number,
  ): MatchBreakdown {
    const candidateSkills = new Set(candidateProfile.skills.map((skill) => skill.toLowerCase()));
    const requiredSkills = (job.skills ?? []).map((skill) => skill.toLowerCase());
    const matchedSkills = requiredSkills.filter((skill) => candidateSkills.has(skill));
    const titleScore = this.scoreTitle(candidateProfile, job.title);
    const skillScore = this.scoreSkills(job, requiredSkills, matchedSkills.length, candidateProfile);
    const experienceScore = this.scoreExperience(candidateProfile.yearsExperience, job.minExperienceYears);
    const seniorityScore = this.scoreSeniority(candidateProfile.seniority, job.seniority);
    const domainScore = this.scoreDomainAlignment(candidateProfile, job);
    const locationScore = this.scoreLocation(candidateProfile, job.location, job.remote);
    const totalScore = titleScore + skillScore + experienceScore + seniorityScore + domainScore + locationScore;
    const workplaceType = this.resolveWorkplaceType(job.location, job.remote);
    const isRelevant = this.isRelevantMatch(titleScore, matchedSkills.length, domainScore, totalScore);

    const reasons = [
      matchedSkills.length ? `${matchedSkills.length} aligned core skills: ${matchedSkills.slice(0, 6).join(', ')}` : undefined,
      titleScore >= 18 ? `Role family is aligned with "${job.title}".` : undefined,
      experienceScore >= 10 ? 'Experience fit is solid for the level of the role.' : undefined,
      locationScore >= 8 ? `Workplace preference aligns (${workplaceType}${job.location ? ` • ${job.location}` : ''}).` : undefined,
      domainScore >= 8 ? 'Strong domain overlap detected between the resume and this role.' : undefined,
    ].filter((reason): reason is string => Boolean(reason));

    const missingRequirements = (job.skills ?? []).filter((skill) => !candidateSkills.has(skill.toLowerCase()));

    return {
      totalScore,
      isRecommended: isRelevant && totalScore >= threshold,
      isRelevant,
      reasons,
      missingRequirements,
    };
  }

  private scoreTitle(candidateProfile: CandidateProfileDocument, title: string) {
    const normalizedTitle = title.toLowerCase();
    const roleFamilies = this.collectRoleFamilies(candidateProfile);

    if (roleFamilies.some((family) => this.matchesRoleFamily(normalizedTitle, family))) {
      return 26;
    }

    const targetRoles = (candidateProfile.targetRoles ?? []).map((role) => role.toLowerCase());
    const directRoleMatch = targetRoles.some((role) => normalizedTitle.includes(role));
    if (directRoleMatch) {
      return 24;
    }

    const tokenOverlap = targetRoles.some((role) =>
      role
        .split(/\W+/)
        .filter((token) => token.length > 3)
        .some((token) => normalizedTitle.includes(token)),
    );

    if (tokenOverlap) {
      return 14;
    }

    return 0;
  }

  private scoreSkills(
    job: Pick<NormalizedJobListing, 'title' | 'description' | 'skills'>,
    requiredSkills: string[],
    matchedSkillCount: number,
    candidateProfile: CandidateProfileDocument,
  ) {
    if (!requiredSkills.length) {
      const candidateSignals = this.toSearchableCandidateText(candidateProfile);
      const jobSignals = `${job.title} ${job.description ?? ''}`.toLowerCase();
      const overlapCount = this.extractMeaningfulTokens(candidateSignals)
        .filter((token) => jobSignals.includes(token))
        .length;

      if (overlapCount >= 3) {
        return 10;
      }
      if (overlapCount >= 1) {
        return 5;
      }

      return 0;
    }

    return Math.round((matchedSkillCount / requiredSkills.length) * 26);
  }

  private scoreExperience(candidateYearsExperience: number, minimumYearsExperience?: number) {
    if (!minimumYearsExperience) {
      return candidateYearsExperience >= 2 ? 8 : 4;
    }
    if (candidateYearsExperience >= minimumYearsExperience) {
      return 14;
    }

    return Math.max(0, Math.round((candidateYearsExperience / minimumYearsExperience) * 14));
  }

  private scoreSeniority(candidateSeniority?: string, jobSeniority?: string) {
    if (!jobSeniority) {
      return candidateSeniority ? 4 : 2;
    }
    if (candidateSeniority === jobSeniority) {
      return 10;
    }
    if (candidateSeniority === 'lead' && jobSeniority === 'senior') {
      return 8;
    }
    if (candidateSeniority === 'senior' && jobSeniority === 'lead') {
      return 7;
    }

    return 0;
  }

  private scoreDomainAlignment(
    candidateProfile: CandidateProfileDocument,
    job: Pick<NormalizedJobListing, 'description' | 'title'>,
  ) {
    const candidateSignals = this.extractMeaningfulTokens(this.toSearchableCandidateText(candidateProfile));
    const jobSignals = new Set(this.extractMeaningfulTokens(`${job.title} ${job.description ?? ''}`));
    const overlapTokens = candidateSignals.filter((token) => jobSignals.has(token));

    if (overlapTokens.length >= 4) {
      return 14;
    }
    if (overlapTokens.length >= 3) {
      return 10;
    }
    if (overlapTokens.length >= 2) {
      return 6;
    }

    return 0;
  }

  private scoreLocation(candidateProfile: CandidateProfileDocument, location?: string, remote?: boolean) {
    const normalizedPreferences = new Set((candidateProfile.workPreferences ?? []).map((value) => value.toLowerCase()));
    const workplaceType = this.resolveWorkplaceType(location, remote);
    let score = 3;

    if (!normalizedPreferences.size) {
      score = workplaceType === 'remote' ? 8 : 6;
    } else if (normalizedPreferences.has(workplaceType)) {
      score = 10;
    } else if (workplaceType === 'hybrid' && normalizedPreferences.has('remote')) {
      score = 7;
    } else if (workplaceType === 'remote' && normalizedPreferences.has('hybrid')) {
      score = 7;
    } else if (workplaceType === 'onsite' && normalizedPreferences.has('hybrid')) {
      score = 4;
    } else if (workplaceType === 'onsite' && normalizedPreferences.has('remote') && !normalizedPreferences.has('onsite')) {
      score = 0;
    }

    const preferredLocations = candidateProfile.preferredLocations.map((value) => value.toLowerCase());
    const normalizedLocation = location?.toLowerCase() ?? '';

    if (preferredLocations.some((value) => normalizedLocation.includes(value))) {
      score = Math.max(score, 10);
    } else if (normalizedLocation.includes('kenya') || normalizedLocation.includes('nairobi')) {
      score = Math.max(score, 8);
    }

    return score;
  }

  private collectRoleFamilies(candidateProfile: CandidateProfileDocument) {
    const roleText = [candidateProfile.headline, ...(candidateProfile.targetRoles ?? [])].join(' ').toLowerCase();
    const families = new Set<string>();

    if (/(project manager|technical project manager|project management|program manager|program management|management officer|implementation manager|delivery manager|project officer)/i.test(roleText)) {
      families.add('project-management');
    }
    if (/(product manager|product owner|product management)/i.test(roleText)) {
      families.add('product');
    }
    if (/(business analyst|analyst)/i.test(roleText)) {
      families.add('analysis');
    }
    if (/(engineer|developer|software|full-stack|frontend|backend|architect)/i.test(roleText)) {
      families.add('engineering');
    }
    if (/(operations|coordinator|administrator)/i.test(roleText)) {
      families.add('operations');
    }

    return [...families];
  }

  private matchesRoleFamily(title: string, family: string) {
    switch (family) {
      case 'project-management':
        return /(project manager|technical project manager|project management|project officer|program manager|delivery manager|implementation manager)/i.test(title);
      case 'product':
        return /(product manager|product owner|product lead)/i.test(title);
      case 'analysis':
        return /(business analyst|data analyst|systems analyst|analyst)/i.test(title);
      case 'engineering':
        return /(engineer|developer|architect|software)/i.test(title);
      case 'operations':
        return /(operations|coordinator|administrator|officer)/i.test(title);
      default:
        return false;
    }
  }

  private isRelevantMatch(titleScore: number, matchedSkillCount: number, domainScore: number, totalScore: number) {
    if (titleScore >= 14) {
      return true;
    }

    if (matchedSkillCount >= 2) {
      return true;
    }

    if (domainScore >= 10) {
      return true;
    }

    return totalScore >= 65 && domainScore >= 6;
  }

  private resolveWorkplaceType(location?: string, remote?: boolean) {
    if (remote) {
      return 'remote';
    }

    const normalizedLocation = location?.toLowerCase() ?? '';

    if (normalizedLocation.includes('hybrid')) {
      return 'hybrid';
    }

    if (normalizedLocation.includes('remote')) {
      return 'remote';
    }

    return 'onsite';
  }

  private toSearchableCandidateText(candidateProfile: CandidateProfileDocument) {
    return [
      candidateProfile.headline,
      candidateProfile.summary,
      ...(candidateProfile.skills ?? []),
      ...(candidateProfile.targetRoles ?? []),
      ...(candidateProfile.experienceHighlights ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  private extractMeaningfulTokens(value: string) {
    return [...new Set(value.split(/\W+/).filter((token) => token.length > 4 && !DOMAIN_STOP_WORDS.has(token)))];
  }
}
