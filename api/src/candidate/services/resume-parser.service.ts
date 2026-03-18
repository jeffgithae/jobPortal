import { BadRequestException, Injectable } from '@nestjs/common';
import pdfParse from 'pdf-parse';

type ParsedResume = {
  fullName?: string;
  email?: string;
  phone?: string;
  headline?: string;
  summary?: string;
  location?: string;
  yearsExperience?: number;
  seniority?: string;
  skills?: string[];
  targetRoles?: string[];
  certifications?: string[];
  languages?: string[];
  experienceHighlights?: string[];
  preferredLocations?: string[];
  workPreferences?: string[];
  resumeText: string;
  sourceResumeName?: string;
};

const KNOWN_SKILLS = [
  'Project Management',
  'Technical Project Management',
  'Program Management',
  'Product Management',
  'Agile',
  'Scrum',
  'Kanban',
  'Stakeholder Management',
  'Stakeholder Engagement',
  'Risk Management',
  'Risk Planning',
  'Change Management',
  'Process Improvement',
  'Release Planning',
  'Roadmapping',
  'Backlog Refinement',
  'Backlog Management',
  'User Story Definition',
  'Prioritization',
  'Trade-off Analysis',
  'System Integration',
  'Interoperability',
  'ERP Management',
  'Digital Health',
  'HMIS',
  'SAP',
  'LabWare',
  'PACS',
  'Jira',
  'Trello',
  'Figma',
  'Adobe XD',
  'MS Project',
  'G-Suite',
  'Git',
  'Power BI',
  'Apache NiFi',
  'ETL',
  'Data Science',
  'Data Engineering',
  'Data Analysis',
  'Machine Learning',
  'Angular',
  'TypeScript',
  'JavaScript',
  'HTML5',
  'CSS3',
  'SASS',
  'Responsive Design',
  'Progressive Web Apps',
  'NestJS',
  'Node.js',
  'React',
  'Next.js',
  'Vue',
  'PHP',
  'Python',
  'Java',
  'C#',
  '.NET',
  'REST APIs',
  'GraphQL',
  'Microservices',
  'Microsoft Azure',
  'Azure DevOps',
  'AWS',
  'Docker',
  'Kubernetes',
  'CI/CD',
  'MySQL',
  'MongoDB',
  'PostgreSQL',
  'Security Auditing',
  'Vulnerability Assessment',
  'OWASP',
  'Secure Coding',
  'Team Mentoring',
  'Code Reviews',
  'Solution Architecture',
  'Drupal',
  'Leadership',
  'Communication',
  'Teamwork',
  'Public Speaking',
  'Decision Making'
];

const KNOWN_CERTIFICATIONS = [
  'Project Management Professional',
  'PMP',
  'Microsoft Azure Developer Associate',
  'Azure DevOps Expert',
  'Lead Auditor Certification',
  'AWS Certified Developer',
  'AWS Certified Solutions Architect',
  'Google Cloud Professional',
  'Scrum Master'
];

const KNOWN_LANGUAGES = [
  'English',
  'Swahili',
  'French',
  'German',
  'Spanish',
  'Portuguese',
  'Arabic'
];

@Injectable()
export class ResumeParserService {
  async parseResumeBuffer(
    buffer: Buffer,
    mimeType: string | undefined,
    sourceResumeName?: string,
  ): Promise<ParsedResume> {
    const fileName = sourceResumeName?.toLowerCase() ?? '';

    if (this.isDocxUpload(mimeType, fileName, buffer)) {
      throw new BadRequestException('DOCX resumes are not supported yet. Upload a PDF or plain-text (.txt) resume.');
    }

    if (!this.isSupportedUpload(mimeType, fileName)) {
      throw new BadRequestException('Unsupported resume format. Upload a PDF or plain-text (.txt) resume.');
    }

    const resumeText = mimeType === 'application/pdf' || fileName.endsWith('.pdf')
      ? (await pdfParse(buffer)).text
      : buffer.toString('utf-8');

    const normalizedText = this.normalizeWhitespace(resumeText);

    if (this.looksCorrupted(normalizedText)) {
      throw new BadRequestException(
        'Resume upload rejected because the extracted text looks corrupted. Export the resume as PDF or plain text and try again.',
      );
    }

    const lines = normalizedText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const topLines = lines.slice(0, 16);
    const summary =
      this.extractSection(normalizedText, 'Professional Summary', [
        'Core Competencies',
        'Technical Skills',
        'Project Management',
        'Soft Skills',
        'Skills',
        'Work History',
        'Experience',
        'Education',
        'Certifications',
        'Awards & Recognitions',
        'Awards',
        'Languages',
      ]) ??
      this.extractSection(normalizedText, 'Summary', [
        'Core Competencies',
        'Technical Skills',
        'Project Management',
        'Soft Skills',
        'Skills',
        'Work History',
        'Experience',
        'Education',
        'Certifications',
        'Awards & Recognitions',
        'Awards',
        'Languages',
      ]) ??
      this.extractSection(normalizedText, 'Profile', [
        'Core Competencies',
        'Technical Skills',
        'Project Management',
        'Soft Skills',
        'Skills',
        'Work History',
        'Experience',
        'Education',
        'Certifications',
      ]);
    const headline = this.extractHeadline(topLines, normalizedText, summary);
    const location = this.extractLocation(topLines, normalizedText);

    return {
      fullName: this.extractFullName(topLines, normalizedText),
      email: normalizedText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase(),
      phone: this.extractPhone(normalizedText),
      headline,
      summary,
      location,
      yearsExperience: this.extractYearsExperience(normalizedText),
      seniority: this.inferSeniority(`${headline ?? ''} ${summary ?? ''}`),
      skills: this.extractSkills(normalizedText),
      targetRoles: this.extractTargetRoles(headline, summary, normalizedText),
      certifications: this.extractFromDictionary(normalizedText, KNOWN_CERTIFICATIONS),
      languages: this.extractFromDictionary(normalizedText, KNOWN_LANGUAGES),
      experienceHighlights: this.extractHighlights(normalizedText),
      preferredLocations: this.extractPreferredLocations(normalizedText, location),
      workPreferences: this.extractWorkPreferences(normalizedText),
      resumeText: normalizedText,
      sourceResumeName,
    };
  }

  private normalizeWhitespace(value: string) {
    return value.replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
  }

  private extractFullName(topLines: string[], text: string) {
    const labeledMatch = text.match(/Name of (?:Expert|Candidate|Applicant)\s*:\s*([A-Za-z][A-Za-z .'-]{2,})/i)?.[1]?.trim();
    if (labeledMatch) {
      return labeledMatch;
    }

    const candidate = topLines.find(
      (line, index) =>
        index < 2 &&
        /^[A-Za-z][A-Za-z .'-]{2,}$/.test(line) &&
        !/@/.test(line) &&
        !/resume|curriculum vitae|position proposed/i.test(line),
    );

    return candidate?.trim();
  }

  private extractHeadline(topLines: string[], text: string, summary?: string) {
    const labeledMatch = text.match(/Position Proposed\s*:\s*([^\n]+)/i)?.[1]?.trim();
    if (labeledMatch) {
      return this.normalizeRoleCandidate(labeledMatch);
    }

    const summaryLead = this.extractRoleFromSummary(summary);
    if (summaryLead) {
      return summaryLead;
    }

    const topRole = topLines.find(
      (line, index) =>
        index > 0 &&
        !/@/.test(line) &&
        !this.looksLikePhone(line) &&
        !this.looksLikeLocation(line) &&
        !this.isSectionHeading(line) &&
        this.looksLikeRole(line),
    );

    if (topRole) {
      return this.normalizeRoleCandidate(topRole);
    }

    return this.extractRoleLikeLines(text)[0];
  }

  private extractSection(text: string, startLabel: string, endLabels: string[]) {
    const escapedStart = this.escapeRegex(startLabel);
    const escapedEnds = endLabels.map((label) => this.escapeRegex(label)).join('|');
    const regex = new RegExp(
      `(?:^|\\n)${escapedStart}\\s*(?:\\n|:)?\\s*([\\s\\S]*?)(?=\\n(?:${escapedEnds})\\s*(?:\\n|$)|$)`,
      'im',
    );
    return text.match(regex)?.[1]?.trim();
  }

  private extractPhone(text: string) {
    const preferredMatch = text.match(/(\+\d[\d ()-]{8,}\d)/)?.[1];
    if (preferredMatch) {
      return preferredMatch.replace(/\s+/g, ' ');
    }

    return text.match(/(\d[\d ()-]{8,}\d)/)?.[1]?.replace(/\s+/g, ' ');
  }

  private extractLocation(topLines: string[], text: string) {
    const nationality = text.match(/Nationality\s*:\s*([A-Za-z .'-]+)/i)?.[1]?.trim();
    if (nationality) {
      return nationality === 'Kenyan' ? 'Kenya' : nationality;
    }

    const inlineLocation = topLines.find((line) => this.looksLikeLocation(line));
    if (inlineLocation) {
      return inlineLocation.split('|')[0]?.trim();
    }

    return topLines.find((line) => this.looksLikeLocation(line));
  }

  private extractYearsExperience(text: string) {
    const directMatch = text.match(/(?:with|having|over)?\s*(\d+)\+?\s+years?(?:\s+of)?\s+experience/i);
    if (directMatch) {
      return Number(directMatch[1]);
    }

    const startYears = [...text.matchAll(/(?:from|to)\s*:?\s*(?:\d{1,2}(?:st|nd|rd|th)?\s*)?(?:[A-Za-z]+\s*)?(\d{4})/gi)]
      .map((match) => Number(match[1]))
      .filter((year) => Number.isFinite(year));

    if (startYears.length === 0) {
      return undefined;
    }

    const currentYear = new Date().getFullYear();
    return Math.max(0, currentYear - Math.min(...startYears));
  }

  private extractFromDictionary(text: string, dictionary: string[]) {
    return dictionary.filter((entry) => new RegExp(this.escapeRegex(entry), 'i').test(text));
  }

  private extractSkills(text: string) {
    const dictionaryMatches = this.extractFromDictionary(text, KNOWN_SKILLS);
    const inferredSkills: string[] = [];
    const skillLineMatches = [
      ...text.matchAll(
        /(?:Core Competencies|Technical Skills|Project Management|Soft Skills|Skills?)\s*[\n:]+([\s\S]{0,1000})/gi,
      ),
    ];

    for (const match of skillLineMatches) {
      const section = match[1]
        .split(/WORK HISTORY|EXPERIENCE|EDUCATION|AWARDS|CERTIFICATIONS/i)[0]
        .replace(/[?•]/g, ',');
      const entries = section
        .split(/[\n,]/)
        .map((entry) => entry.replace(/^[-:]+/, '').trim())
        .filter((entry) => entry.length >= 3 && entry.length <= 60)
        .filter((entry) => !this.isSectionHeading(entry));
      inferredSkills.push(...entries);
    }

    const cleanedSkills = [...new Set([...dictionaryMatches, ...inferredSkills.map((entry) => this.cleanHeadline(entry))])]
      .filter((entry) => !this.isSectionHeading(entry))
      .slice(0, 36);

    return cleanedSkills;
  }

  private extractTargetRoles(headline: string | undefined, summary: string | undefined, text: string) {
    const candidates = [headline, this.extractRoleFromSummary(summary), ...this.extractRoleLikeLines(text)]
      .filter(Boolean)
      .map((entry) => this.normalizeRoleCandidate(entry as string))
      .filter((entry) => this.looksLikeRole(entry));

    return [...new Set(candidates)].slice(0, 8);
  }

  private extractRoleLikeLines(text: string) {
    const roleLines = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter(
        (line) =>
          !/@/.test(line) &&
          !this.looksLikePhone(line) &&
          !this.looksLikeLocation(line) &&
          !this.isSectionHeading(line),
      )
      .map((line) => this.normalizeRoleCandidate(line))
      .filter((line) => this.looksLikeRole(line));

    return [...new Set(roleLines)];
  }

  private inferSeniority(text: string) {
    if (/principal|staff|director|head/i.test(text)) {
      return 'principal';
    }

    if (/lead|manager/i.test(text)) {
      return 'lead';
    }

    if (/senior/i.test(text)) {
      return 'senior';
    }

    if (/mid|intermediate/i.test(text)) {
      return 'mid';
    }

    if (/junior|intern/i.test(text)) {
      return 'junior';
    }

    return undefined;
  }

  private extractHighlights(text: string) {
    const highlights: string[] = [];
    const patterns = [
      /(trained|onboarded).{0,40}\d[\d,]*\+? users/i,
      /(reduced|cut).{0,40}\d+%/i,
      /(improved|boosted|raised).{0,40}\d+%/i,
      /(led|managed|supervised).{0,60}(team|projects|project)/i,
      /(deployed|implemented).{0,60}(HMIS|SAP|LabWare|system)/i,
      /(ahead of schedule|earlier than planned)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern)?.[0]?.trim();
      if (match) {
        highlights.push(match.charAt(0).toUpperCase() + match.slice(1));
      }
    }

    return [...new Set(highlights)].slice(0, 6);
  }

  private extractPreferredLocations(text: string, parsedLocation?: string) {
    const locations = new Set<string>();

    if (/remote/i.test(text)) {
      locations.add('Remote');
    }

    if (parsedLocation) {
      locations.add(parsedLocation);
    }

    return [...locations];
  }

  private extractWorkPreferences(text: string) {
    const preferences: string[] = [];

    if (/remote/i.test(text)) {
      preferences.push('remote');
    }
    if (/hybrid/i.test(text)) {
      preferences.push('hybrid');
    }
    if (/on[- ]?site/i.test(text)) {
      preferences.push('onsite');
    }

    return preferences;
  }

  private looksLikePhone(line: string) {
    return /(\+?\d[\d ()-]{8,}\d)/.test(line);
  }

  private looksLikeLocation(line: string) {
    if (/remote/i.test(line)) {
      return true;
    }

    return /^[A-Za-z .'-]+,\s*[A-Za-z .'-]+(?:\s*\|.*)?$/.test(line) && !this.isSectionHeading(line);
  }

  private looksLikeRole(line: string) {
    const normalized = this.normalizeRoleCandidate(line);

    if (!normalized || normalized.length > 80 || normalized.length < 6 || this.isSectionHeading(normalized)) {
      return false;
    }

    if (
      /^[•\-*]/.test(line) ||
      /^[a-z]/.test(normalized) ||
      /[%]/.test(normalized) ||
      /[.]$/.test(normalized) ||
      /\b(responsible|supported|helped|reduced|improved|achieved|trained|implemented|boosting|managed to)\b/i.test(normalized) ||
      /\b(project management professional|pmp|certification|award|recognition|tracker)\b/i.test(normalized)
    ) {
      return false;
    }

    const words = normalized.split(/\s+/).filter(Boolean);
    if (words.length > 7) {
      return false;
    }

    return /(engineer|developer|architect|manager|management officer|lead|consultant|analyst|designer|specialist|scientist|officer|coordinator|administrator|director|scrum master|product owner)/i.test(
      normalized,
    );
  }

  private isSectionHeading(line: string) {
    return /^(professional summary|summary|profile|experience|professional experience|work history|education|skills|core competencies|technical skills|soft skills|project management|certifications|projects|languages|contacts?|awards( & recognitions)?|recognitions)$/i.test(line);
  }

  private isSupportedUpload(mimeType: string | undefined, fileName: string) {
    return Boolean(
      mimeType === 'application/pdf' ||
      mimeType === 'text/plain' ||
      fileName.endsWith('.pdf') ||
      fileName.endsWith('.txt'),
    );
  }

  private isDocxUpload(mimeType: string | undefined, fileName: string, buffer: Buffer) {
    return Boolean(
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileName.endsWith('.docx') ||
      (buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && fileName.endsWith('.doc')),
    );
  }

  private looksCorrupted(text: string) {
    const replacementCharCount = (text.match(/\uFFFD/g) ?? []).length;
    const controlCharCount = (text.match(/[\u0000-\u0008\u000E-\u001F]/g) ?? []).length;
    const totalLength = Math.max(text.length, 1);

    return (
      text.includes('[Content_Types].xml') ||
      text.includes('word/document.xml') ||
      replacementCharCount / totalLength > 0.005 ||
      controlCharCount / totalLength > 0.005
    );
  }

  private cleanHeadline(value: string) {
    const cleaned = value.replace(/\s{2,}/g, ' ').replace(/\s+\|\s+/g, ' | ').trim();

    if (/^[A-Z0-9 /&-]+$/.test(cleaned)) {
      return cleaned
        .toLowerCase()
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
    }

    return cleaned;
  }

  private extractRoleFromSummary(summary?: string) {
    if (!summary) {
      return undefined;
    }

    const normalizedSummary = summary.replace(/\s+/g, ' ').trim();
    const summaryLead =
      normalizedSummary.match(/^([A-Za-z][A-Za-z/& ,'-]{4,80}?) with \d+\+? years?(?:\s+of)? experience/i)?.[1]?.trim() ??
      normalizedSummary.match(/^([A-Za-z][A-Za-z/& ,'-]{4,80}?) bringing \d+\+? years/i)?.[1]?.trim();

    if (!summaryLead || !this.looksLikeRole(summaryLead)) {
      return undefined;
    }

    return this.normalizeRoleCandidate(summaryLead);
  }

  private normalizeRoleCandidate(value: string) {
    const withoutBullets = value.replace(/^[•\-*]+\s*/, '');
    const withoutDates = withoutBullets
      .replace(/\b\d{1,2}\/\d{4}\s+to\s+(?:current|present|\d{1,2}\/\d{4})\b/gi, '')
      .replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}\s+to\s+(?:current|present|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4})\b/gi, '')
      .replace(/\b\d{4}\s*[-/]\s*\d{4}\b/gi, '')
      .replace(/\b\d{4}\s+to\s+\d{4}\b/gi, '');
    const primarySegment = withoutDates.split(/[|•]/)[0] ?? withoutDates;
    return this.cleanHeadline(primarySegment).replace(/\s{2,}/g, ' ').trim();
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

