import { CandidateProfileService } from './candidate-profile.service';

describe('CandidateProfileService', () => {
  it('normalizes uploaded resume data before saving the profile', async () => {
    const profile = {
      ownerKey: 'user-1',
      sourceResumeName: undefined,
      save: jest.fn().mockImplementation(function save(this: Record<string, unknown>) {
        return Promise.resolve(this);
      }),
    } as any;

    const candidateProfileModel = {
      findOne: jest.fn().mockResolvedValue(profile),
      findOneAndUpdate: jest.fn(),
      find: jest.fn(),
    } as any;

    const resumeParserService = {
      parseResumeBuffer: jest.fn().mockResolvedValue({
        fullName: 'Ivy Angela Wanjiru',
        email: 'ivyangela5@gmail.com',
        phone: '+254708292522',
        headline: undefined,
        summary: 'Technical Project Manager with 4 years experience leading software deployments.',
        location: 'Nairobi, Kenya',
        yearsExperience: 4,
        seniority: 'lead',
        skills: ['Jira', 'Agile'],
        targetRoles: ['Technical Project Manager'],
        certifications: [],
        languages: ['English'],
        experienceHighlights: ['Led deployments'],
        preferredLocations: [],
        workPreferences: [],
        resumeText: 'resume text',
        sourceResumeName: 'ivy.txt',
      }),
    } as any;

    const service = new CandidateProfileService(candidateProfileModel, resumeParserService);

    const savedProfile = await service.uploadResume(
      {
        buffer: Buffer.from('resume text'),
        mimetype: 'text/plain',
        originalname: 'ivy.txt',
      },
      'user-1',
    );

    expect(savedProfile.headline).toBe('Technical Project Manager');
    expect(savedProfile.targetRoles).toEqual(['Technical Project Manager']);
    expect(savedProfile.preferredLocations).toEqual(['Nairobi, Kenya']);
    expect(savedProfile.email).toBe('ivyangela5@gmail.com');
    expect(profile.save).toHaveBeenCalled();
  });
});
