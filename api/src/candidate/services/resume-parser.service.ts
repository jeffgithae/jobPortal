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
  'Git',
  'MySQL',
  'MongoDB',
  'PostgreSQL',
  'Power BI',
  'Apache NiFi',
  'ETL',
  'Data Science',
  'Data Engineering',
  'Data Analysis',
  'Machine Learning',
  'Security Auditing',
  'Vulnerability Assessment',
  'OWASP',
  'Secure Coding',
  'Team Mentoring',
  'Code Reviews',
  'Solution Architecture',
  'Agile',
  'Drupal'
];

const KNOWN_CERTIFICATIONS = [
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

    const topLines = normalizedText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 12);
    const headline = this.extractHeadline(topLines, normalizedText);
    const summary =
      this.extractSection(normalizedText, 'Professional Summary', 'Core Compet') ??
      this.extractSection(normalizedText, 'Summary', 'Experience') ??
      this.extractSection(normalizedText, 'Profile', 'Experience');
    const location = this.extractLocation(topLines, normalizedText);

    return {
      fullName: this.extractFullName(topLines, normalizedText),
      email: normalizedText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase(),
      phone: this.extractPhone(normalizedText),
      headline,
      summary,
      location,
      yearsExperience: this.extractYearsExperience(normalizedText),
      seniority: this.inferSeniority(headline ?? normalizedText),
      skills: this.extractFromDictionary(normalizedText, KNOWN_SKILLS),
      targetRoles: this.extractTargetRoles(headline, normalizedText),
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

  private extractHeadline(topLines: string[], text: string) {
    const labeledMatch = text.match(/Position Proposed\s*:\s*([^\n]+)/i)?.[1]?.trim();
    if (labeledMatch) {
      return this.cleanHeadline(labeledMatch);
    }

    const fallback = topLines.find(
      (line, index) =>
        index > 0 &&
        !/@/.test(line) &&
        !this.looksLikePhone(line) &&
        !this.looksLikeLocation(line) &&
        !this.isSectionHeading(line),
    );

    return fallback ? this.cleanHeadline(fallback) : undefined;
  }

  private extractSection(text: string, startLabel: string, endLabel: string) {
    const regex = new RegExp(`${startLabel}([\\s\\S]*?)${endLabel}`, 'i');
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

    return topLines.find((line) => this.looksLikeLocation(line));
  }

  private extractYearsExperience(text: string) {
    const yearsMatch = text.match(/(\d+)\+?\s+years of experience/i);
    if (yearsMatch) {
      return Number(yearsMatch[1]);
    }

    const startYears = [...text.matchAll(/From:\s*(?:\d{1,2}(?:st|nd|rd|th)?\s*)?(?:[A-Za-z]+\s*)?(\d{4})/gi)]
      .map((match) => Number(match[1]))
      .filter((year) => Number.isFinite(year));

    if (startYears.length === 0) {
      return undefined;
    }

    const currentYear = new Date().getFullYear();
    return Math.max(0, currentYear - Math.min(...startYears));
  }

  private extractFromDictionary(text: string, dictionary: string[]) {
    return dictionary.filter((entry) => new RegExp(entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text));
  }

  private extractTargetRoles(headline: string | undefined, text: string) {
    const roleSource = [headline, ...text.split('\n').slice(0, 20)]
      .filter(Boolean)
      .join(' | ');
    const segments = roleSource
      .split(/[|•]/)
      .map((segment) => this.cleanHeadline(segment.trim()))
      .filter((segment) => this.looksLikeRole(segment));

    return [...new Set(segments)].slice(0, 6);
  }

  private inferSeniority(text: string) {
    if (/principal|staff/i.test(text)) {
      return 'principal';
    }

    if (/lead|manager|head/i.test(text)) {
      return 'lead';
    }

    if (/senior/i.test(text)) {
      return 'senior';
    }

    if (/mid|intermediate/i.test(text)) {
      return 'mid';
    }

    if (/junior/i.test(text)) {
      return 'junior';
    }

    return undefined;
  }

  private extractHighlights(text: string) {
    const highlights: string[] = [];
    const patterns = [
      /team of \d+\s+(developers|engineers|people)/i,
      /(scaled|grew).{0,40}\d+%/i,
      /(improved|reduced|increased).{0,40}\d+%/i,
      /(led|managed).{0,50}(team|platform|project)/i,
      /Role:\s*Main Developer/i,
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

    return /^[A-Za-z .'-]+,\s*[A-Za-z .'-]+$/.test(line) && !this.isSectionHeading(line);
  }

  private looksLikeRole(line: string) {
    if (line.length > 80 || line.length < 6 || this.isSectionHeading(line)) {
      return false;
    }

    return /(engineer|developer|architect|manager|lead|consultant|analyst|designer|specialist|scientist)/i.test(line);
  }

  private isSectionHeading(line: string) {
    return /^(summary|profile|experience|education|skills|certifications|projects|languages|contacts?)$/i.test(line);
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
    return value.replace(/\s{2,}/g, ' ').replace(/\s+\|\s+/g, ' | ').trim();
  }
}
