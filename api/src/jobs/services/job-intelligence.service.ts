import { Injectable } from '@nestjs/common';
import { load } from 'cheerio';

const KNOWN_SKILLS = [
  'Angular',
  'TypeScript',
  'JavaScript',
  'Node.js',
  'NestJS',
  'MongoDB',
  'PostgreSQL',
  'MySQL',
  'Azure',
  'Azure DevOps',
  'Docker',
  'CI/CD',
  'REST APIs',
  'Microservices',
  'Security Auditing',
  'OWASP',
  'Secure Coding',
  'Agile',
  'Leadership',
  'Solution Architecture',
  'PHP',
  'Drupal',
  'Reporting',
  'HTML5',
  'CSS3'
];

@Injectable()
export class JobIntelligenceService {
  toPlainText(value?: string) {
    if (!value) {
      return '';
    }

    if (!/<[a-z][\s\S]*>/i.test(value)) {
      return value.replace(/\s+/g, ' ').trim();
    }

    return load(value).text().replace(/\s+/g, ' ').trim();
  }

  extractSkills(...values: Array<string | undefined>) {
    const combined = values.filter(Boolean).join(' ');
    return KNOWN_SKILLS.filter((skill) => new RegExp(skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(combined));
  }

  extractYearsExperience(...values: Array<string | undefined>) {
    const combined = values.filter(Boolean).join(' ');
    const match = combined.match(/(\d+)\+?\s+years/i);
    return match ? Number(match[1]) : undefined;
  }

  inferSeniority(title?: string, description?: string) {
    const combined = `${title ?? ''} ${description ?? ''}`;

    if (/staff|principal/i.test(combined)) {
      return 'staff';
    }
    if (/lead/i.test(combined)) {
      return 'lead';
    }
    if (/senior/i.test(combined)) {
      return 'senior';
    }
    if (/junior/i.test(combined)) {
      return 'junior';
    }

    return undefined;
  }

  inferRemote(location?: string, description?: string) {
    return /remote/i.test(`${location ?? ''} ${description ?? ''}`);
  }

  inferEmploymentType(description?: string) {
    const combined = description ?? '';

    if (/contract/i.test(combined)) {
      return 'Contract';
    }
    if (/full[- ]time/i.test(combined)) {
      return 'Full-time';
    }

    return undefined;
  }
}
