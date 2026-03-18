import { Injectable } from '@nestjs/common';
import { load } from 'cheerio';

const KNOWN_SKILLS = [
  'Project Management',
  'Technical Project Management',
  'Program Management',
  'Product Management',
  'Agile',
  'Scrum',
  'Kanban',
  'Stakeholder Management',
  'Risk Management',
  'Change Management',
  'Roadmapping',
  'Backlog Refinement',
  'Release Planning',
  'User Story Definition',
  'System Integration',
  'Interoperability',
  'ERP',
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
  'Leadership',
  'Solution Architecture',
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

    let normalized = value;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const decoded = load(`<body>${normalized}</body>`).text();
      const collapsed = decoded.replace(/\u00a0/g, ' ').replace(/&nbsp;/gi, ' ').trim();

      if (collapsed === normalized) {
        normalized = collapsed;
        break;
      }

      normalized = collapsed;
    }

    if (/<[a-z][\s\S]*>/i.test(normalized)) {
      normalized = load(normalized).text();
    }

    return normalized
      .replace(/\s*•\s*/g, ' • ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  extractSkills(...values: Array<string | undefined>) {
    const combined = values.filter(Boolean).join(' ');
    return KNOWN_SKILLS.filter((skill) => new RegExp(skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(combined));
  }

  extractYearsExperience(...values: Array<string | undefined>) {
    const combined = values.filter(Boolean).join(' ');
    const match = combined.match(/(\d+)\+?\s+years?(?:\s+of)?\s+experience/i) ?? combined.match(/(\d+)\+?\s+years/i);
    return match ? Number(match[1]) : undefined;
  }

  inferSeniority(title?: string, description?: string) {
    const combined = `${title ?? ''} ${description ?? ''}`;

    if (/staff|principal|director|head/i.test(combined)) {
      return 'staff';
    }
    if (/lead|manager/i.test(combined)) {
      return 'lead';
    }
    if (/senior/i.test(combined)) {
      return 'senior';
    }
    if (/junior|intern/i.test(combined)) {
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
    if (/part[- ]time/i.test(combined)) {
      return 'Part-time';
    }
    if (/intern/i.test(combined)) {
      return 'Internship';
    }
    if (/full[- ]time/i.test(combined)) {
      return 'Full-time';
    }

    return undefined;
  }
}
