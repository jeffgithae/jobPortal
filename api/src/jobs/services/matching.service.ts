import { Injectable } from '@nestjs/common';
import { CandidateProfileDocument } from '../../candidate/schemas/candidate-profile.schema';
import { NormalizedJobListing } from '../source-adapters/job-source-adapter.interface';

type MatchBreakdown = {
  totalScore: number;
  isRecommended: boolean;
  reasons: string[];
  missingRequirements: string[];
};

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
    const titleScore = this.scoreTitle(candidateProfile.targetRoles, job.title);
    const skillScore = this.scoreSkills(requiredSkills, matchedSkills.length);
    const experienceScore = this.scoreExperience(candidateProfile.yearsExperience, job.minExperienceYears);
    const seniorityScore = this.scoreSeniority(candidateProfile.seniority, job.seniority);
    const domainScore = this.scoreDomainAlignment(candidateProfile, job);
    const locationScore = this.scoreLocation(candidateProfile, job.location, job.remote);
    const totalScore = titleScore + skillScore + experienceScore + seniorityScore + domainScore + locationScore;

    const reasons = [
      matchedSkills.length ? `${matchedSkills.length} aligned core skills: ${matchedSkills.slice(0, 5).join(', ')}` : undefined,
      titleScore >= 14 ? `Target-role alignment is strong for "${job.title}".` : undefined,
      experienceScore >= 12 ? 'Experience fit is solid for the stated seniority and years required.' : undefined,
      locationScore >= 8 ? `Location preference matches (${job.remote ? 'remote' : job.location}).` : undefined,
      domainScore >= 8 ? 'Domain overlap detected across architecture, leadership, and delivery.' : undefined,
    ].filter((reason): reason is string => Boolean(reason));

    const missingRequirements = (job.skills ?? []).filter((skill) => !candidateSkills.has(skill.toLowerCase()));

    return {
      totalScore,
      isRecommended: totalScore >= threshold,
      reasons,
      missingRequirements,
    };
  }

  private scoreTitle(targetRoles: string[], title: string) {
    const normalizedTitle = title.toLowerCase();
    const matchingRoles = targetRoles.filter((role) =>
      normalizedTitle.includes(role.toLowerCase()) ||
      role.toLowerCase().split(/\W+/).some((token) => token.length > 4 && normalizedTitle.includes(token)),
    );

    if (matchingRoles.some((role) => normalizedTitle.includes(role.toLowerCase()))) {
      return 20;
    }
    if (matchingRoles.length) {
      return 15;
    }
    if (/engineer|developer|architect|lead/.test(normalizedTitle)) {
      return 10;
    }

    return 4;
  }

  private scoreSkills(requiredSkills: string[], matchedSkillCount: number) {
    if (!requiredSkills.length) {
      return 20;
    }

    return Math.round((matchedSkillCount / requiredSkills.length) * 35);
  }

  private scoreExperience(candidateYearsExperience: number, minimumYearsExperience?: number) {
    if (!minimumYearsExperience) {
      return 12;
    }
    if (candidateYearsExperience >= minimumYearsExperience) {
      return 15;
    }

    return Math.max(4, Math.round((candidateYearsExperience / minimumYearsExperience) * 15));
  }

  private scoreSeniority(candidateSeniority?: string, jobSeniority?: string) {
    if (!jobSeniority) {
      return 8;
    }
    if (candidateSeniority === jobSeniority) {
      return 10;
    }
    if (candidateSeniority === 'lead' && jobSeniority === 'senior') {
      return 9;
    }
    if (candidateSeniority === 'senior' && jobSeniority === 'lead') {
      return 8;
    }

    return 4;
  }

  private scoreDomainAlignment(
    candidateProfile: CandidateProfileDocument,
    job: Pick<NormalizedJobListing, 'description' | 'title'>,
  ) {
    const candidateSignals = [
      ...candidateProfile.skills,
      ...candidateProfile.targetRoles,
      ...candidateProfile.experienceHighlights,
    ].join(' ').toLowerCase();
    const jobSignals = `${job.title} ${job.description ?? ''}`.toLowerCase();
    const domainTokens = ['lead', 'architecture', 'security', 'azure', 'erp', 'crm', 'board', 'product'];
    const overlapCount = domainTokens.filter((token) => candidateSignals.includes(token) && jobSignals.includes(token)).length;

    if (overlapCount >= 3) {
      return 10;
    }
    if (overlapCount >= 2) {
      return 8;
    }
    if (overlapCount >= 1) {
      return 5;
    }

    return 2;
  }

  private scoreLocation(candidateProfile: CandidateProfileDocument, location?: string, remote?: boolean) {
    if (remote) {
      return 10;
    }

    const preferredLocations = candidateProfile.preferredLocations.map((value) => value.toLowerCase());
    const normalizedLocation = location?.toLowerCase() ?? '';

    if (preferredLocations.some((value) => normalizedLocation.includes(value))) {
      return 10;
    }
    if (normalizedLocation.includes('kenya') || normalizedLocation.includes('nairobi')) {
      return 8;
    }

    return 4;
  }
}
