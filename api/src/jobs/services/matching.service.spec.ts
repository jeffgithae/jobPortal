import { MatchingService } from './matching.service';

describe('MatchingService', () => {
  let service: MatchingService;

  beforeEach(() => {
    service = new MatchingService();
  });

  const projectManagerProfile = {
    headline: 'Technical Project Manager',
    summary: 'Technical Project Manager with 4 years experience leading healthcare deployments.',
    skills: ['Agile', 'Jira', 'Digital Health', 'HMIS', 'SAP'],
    targetRoles: ['Technical Project Manager', 'Project Management Officer'],
    experienceHighlights: ['Led healthcare rollout'],
    preferredLocations: ['Nairobi, Kenya'],
    workPreferences: [],
    yearsExperience: 4,
    seniority: 'lead',
    resumeText: 'Technical Project Manager Jira Digital Health HMIS SAP healthcare rollout',
  } as any;

  it('keeps aligned project-management jobs relevant', () => {
    const result = service.scoreJob(
      projectManagerProfile,
      {
        title: 'Technical Project Manager',
        description: 'Lead digital health rollouts, stakeholder management, Jira delivery coordination, and system integration across hospital platforms.',
        skills: ['Project Management', 'Stakeholder Management', 'Jira', 'System Integration', 'Digital Health'],
        requirements: [],
        location: 'Nairobi, Kenya',
        remote: false,
        minExperienceYears: 3,
        seniority: 'lead',
      },
      85,
    );

    expect(result.isRelevant).toBe(true);
    expect(result.totalScore).toBeGreaterThanOrEqual(70);
  });

  it('filters out unrelated engineering jobs for a project-management resume', () => {
    const result = service.scoreJob(
      projectManagerProfile,
      {
        title: 'Senior Backend Engineer',
        description: 'Build NestJS microservices, PostgreSQL backends, Dockerized deployments, and CI/CD pipelines.',
        skills: ['NestJS', 'Node.js', 'PostgreSQL', 'Docker', 'CI/CD'],
        requirements: [],
        location: 'Remote',
        remote: true,
        minExperienceYears: 4,
        seniority: 'senior',
      },
      85,
    );

    expect(result.isRelevant).toBe(false);
    expect(result.totalScore).toBeLessThan(40);
  });
});

