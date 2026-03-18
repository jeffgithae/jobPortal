import { ResumeParserService } from './resume-parser.service';

describe('ResumeParserService', () => {
  let service: ResumeParserService;

  beforeEach(() => {
    service = new ResumeParserService();
  });

  it('extracts a project-management profile from a resume text upload', async () => {
    const resumeText = `Ivy Angela Wanjiru
Nairobi, Kenya | ivyangela5@gmail.com | +254708292522
PROFESSIONAL SUMMARY
Technical Project Manager with 4 years experience leading software deployments in healthcare and enterprise environments.
CORE COMPETENCIES
Agile, Jira, Digital Health, HMIS, SAP, Stakeholder Management, Risk Management
WORK HISTORY
PROJECT MANAGEMENT OFFICER 01/2023 to Current
TECHNICAL PROJECT MANAGER 02/2022 to 12/2022`;

    const parsed = await service.parseResumeBuffer(Buffer.from(resumeText), 'text/plain', 'ivy.txt');

    expect(parsed.fullName).toBe('Ivy Angela Wanjiru');
    expect(parsed.headline).toBe('Technical Project Manager');
    expect(parsed.yearsExperience).toBe(4);
    expect(parsed.targetRoles).toEqual(
      expect.arrayContaining(['Technical Project Manager', 'Project Management Officer']),
    );
    expect(parsed.skills).toEqual(expect.arrayContaining(['Jira', 'Digital Health', 'HMIS', 'SAP']));
    expect(parsed.summary).toContain('Technical Project Manager with 4 years experience');
  });

  it('extracts an engineering profile from a resume text upload', async () => {
    const resumeText = `Jane Doe
Remote | jane@example.com | +15551234567
SUMMARY
Senior Backend Engineer with 6 years of experience building distributed APIs and cloud services.
TECHNICAL SKILLS
Node.js, NestJS, PostgreSQL, Docker, CI/CD, AWS
EXPERIENCE
SENIOR BACKEND ENGINEER 2022 to Current`;

    const parsed = await service.parseResumeBuffer(Buffer.from(resumeText), 'text/plain', 'jane.txt');

    expect(parsed.headline).toBe('Senior Backend Engineer');
    expect(parsed.yearsExperience).toBe(6);
    expect(parsed.targetRoles).toEqual(expect.arrayContaining(['Senior Backend Engineer']));
    expect(parsed.skills).toEqual(expect.arrayContaining(['Node.js', 'NestJS', 'PostgreSQL', 'Docker']));
  });
});
