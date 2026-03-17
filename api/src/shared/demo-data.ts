import { DEFAULT_INGEST_CRON, DEFAULT_INGEST_TIMEZONE, DEFAULT_OWNER_KEY } from './system-defaults';

export const DEMO_USER_SEED = {
  ownerKey: DEFAULT_OWNER_KEY,
  displayName: 'Jeff Kinyua Githae',
  email: 'jeffgithae03@gmail.com',
  seeded: true
};

export const DEMO_PROFILE_SEED = {
  ownerKey: DEFAULT_OWNER_KEY,
  fullName: 'Jeff Kinyua Githae',
  email: 'jeffgithae03@gmail.com',
  phone: '+254 715151494',
  headline: 'Senior Software Engineer | Product Lead | Full-Stack Developer',
  summary:
    'Accomplished Senior Software Engineer and Product Lead with 5+ years of experience in software development, solution architecture, and team leadership. Proven track record of designing and delivering scalable web applications and enterprise systems.',
  location: 'Nairobi, Kenya',
  preferredLocations: ['Remote', 'Nairobi, Kenya', 'Canada'],
  workPreferences: ['remote', 'hybrid'],
  yearsExperience: 5,
  seniority: 'senior',
  targetRoles: [
    'Senior Software Engineer',
    'Product Lead',
    'Technical Lead',
    'Solution Architect',
    'Full-Stack Developer'
  ],
  skills: [
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
    'PHP',
    'REST APIs',
    'Microservices',
    'Microsoft Azure',
    'Azure DevOps',
    'Docker',
    'CI/CD',
    'Git',
    'MySQL',
    'MongoDB',
    'PostgreSQL',
    'Security Auditing',
    'OWASP',
    'Secure Coding',
    'Team Mentoring',
    'Code Reviews',
    'Solution Architecture',
    'Agile',
    'Drupal'
  ],
  certifications: [
    'Microsoft Azure Developer Associate',
    'Azure DevOps Expert',
    'Lead Auditor Certification'
  ],
  languages: ['English', 'Swahili'],
  education: [
    {
      institution: 'University of Nairobi',
      degree: 'Bachelor of Science in Computer Science',
      period: 'September 2016 - December 2020'
    },
    {
      institution: 'University of Nairobi',
      degree: 'Diploma in Computer Science',
      period: 'September 2016 - December 2018'
    }
  ],
  experienceHighlights: [
    'Leading the EBM Suite team of 6 engineers at Sibasi Ltd since November 2020.',
    'Scaled a critical agricultural platform user base by 300% and improved system performance by 40%.',
    'Mentored 5+ developers while establishing code review and engineering quality standards.',
    'Delivers client-facing solutions for Canadian-based engagements at The Foreign Venture Group.'
  ],
  resumeText: `Jeff Kinyua Githae
Senior Software Engineer | Product Lead | Full-Stack Developer

Professional Summary
Accomplished Senior Software Engineer and Product Lead with 5+ years of experience in software development, solution architecture, and team leadership. Proven track record of designing and delivering scalable web applications and enterprise systems. Currently leading the EBM Suite team of 6 developers at Sibasi Ltd while also serving as a Web Developer for The Foreign Venture Group.

Core Competencies
Angular, TypeScript, JavaScript, HTML5, CSS3, SASS, NestJS, Node.js, PHP, REST APIs, Microservices, Microsoft Azure, Azure DevOps, Docker, CI/CD, Git, MySQL, MongoDB, PostgreSQL, Security Auditing, OWASP, Team Mentoring, Code Reviews, Solution Architecture, Agile, Drupal.

Professional Experience
Senior Software Engineer & Product Lead | Sibasi Ltd | November 2020 - Present
Web Developer | The Foreign Venture Group | September 2025 - Present

Certifications
Microsoft Azure Developer Associate
Azure DevOps Expert
Lead Auditor Certification`,
  sourceResumeName: 'Jeff Kinyua Githae - Senior Software Engineer.pdf'
};

export const DEFAULT_SOURCE_SEEDS = [
  {
    name: 'Curated Starter Roles',
    type: 'mock-curated',
    enabled: true,
    runCron: DEFAULT_INGEST_CRON,
    timeZone: DEFAULT_INGEST_TIMEZONE,
    config: {}
  },
  {
    name: 'Remote Jobs (Greenhouse)',
    type: 'greenhouse-board',
    enabled: true,
    runCron: DEFAULT_INGEST_CRON,
    timeZone: DEFAULT_INGEST_TIMEZONE,
    config: {
      boardToken: 'remotecom',
      company: 'Remote'
    }
  },
  {
    name: 'Revefi Jobs (Lever)',
    type: 'lever-postings',
    enabled: true,
    runCron: DEFAULT_INGEST_CRON,
    timeZone: DEFAULT_INGEST_TIMEZONE,
    config: {
      companySlug: 'revefi',
      company: 'Revefi'
    }
  },
  {
    name: 'Blinq Jobs (Lever)',
    type: 'lever-postings',
    enabled: true,
    runCron: DEFAULT_INGEST_CRON,
    timeZone: DEFAULT_INGEST_TIMEZONE,
    config: {
      companySlug: 'blinq',
      company: 'Blinq'
    }
  },
  {
    name: 'Flo Health Jobs (Greenhouse)',
    type: 'greenhouse-board',
    enabled: true,
    runCron: DEFAULT_INGEST_CRON,
    timeZone: DEFAULT_INGEST_TIMEZONE,
    config: {
      boardToken: 'flohealth',
      company: 'Flo Health'
    }
  },
  {
    name: 'Greenhouse Connector Template',
    type: 'greenhouse-board',
    enabled: false,
    runCron: DEFAULT_INGEST_CRON,
    timeZone: DEFAULT_INGEST_TIMEZONE,
    config: {
      boardToken: 'replace-with-greenhouse-board-token',
      company: 'Target Company'
    }
  },
  {
    name: 'Lever Connector Template',
    type: 'lever-postings',
    enabled: false,
    runCron: DEFAULT_INGEST_CRON,
    timeZone: DEFAULT_INGEST_TIMEZONE,
    config: {
      companySlug: 'replace-with-lever-company-slug',
      company: 'Target Company'
    }
  }
];

export const DEMO_CURATED_JOBS = [
  {
    externalId: 'mock-senior-fullstack-001',
    title: 'Senior Full-Stack Engineer (Angular + NestJS)',
    company: 'AgriPulse',
    location: 'Remote, Africa',
    remote: true,
    employmentType: 'Full-time',
    url: 'https://example.com/jobs/mock-senior-fullstack-001',
    description:
      'Lead delivery of an agricultural SaaS platform using Angular, TypeScript, NestJS, MongoDB, Azure, and Docker. Own architecture decisions, mentor engineers, work directly with stakeholders, and improve API performance for a growing customer base.',
    requirements: [
      '5+ years building production web applications',
      'Strong Angular and NestJS experience',
      'Hands-on MongoDB and API optimization',
      'Mentoring or technical leadership experience'
    ],
    skills: ['Angular', 'TypeScript', 'NestJS', 'MongoDB', 'Azure', 'Docker', 'Leadership'],
    minExperienceYears: 5,
    seniority: 'senior'
  },
  {
    externalId: 'mock-product-lead-002',
    title: 'Product Engineering Lead',
    company: 'BoardFlow',
    location: 'Remote',
    remote: true,
    employmentType: 'Full-time',
    url: 'https://example.com/jobs/mock-product-lead-002',
    description:
      'Own roadmap delivery for a governance platform. Combine product thinking with full-stack execution across Angular, Node.js, PostgreSQL, and Azure DevOps while coaching a small engineering team.',
    requirements: [
      'Experience leading a product engineering squad',
      'Strong Angular and Node.js delivery background',
      'Comfort with stakeholder communication and sprint leadership'
    ],
    skills: ['Angular', 'Node.js', 'PostgreSQL', 'Azure DevOps', 'Leadership', 'Agile'],
    minExperienceYears: 5,
    seniority: 'lead'
  },
  {
    externalId: 'mock-solutions-architect-003',
    title: 'Solutions Architect, SME Platforms',
    company: 'LedgerNest',
    location: 'Hybrid, Nairobi',
    remote: false,
    employmentType: 'Full-time',
    url: 'https://example.com/jobs/mock-solutions-architect-003',
    description:
      'Design scalable ERP and CRM workflows for small businesses. Drive secure system design, review architecture, and guide a delivery team building with NestJS, MongoDB, PostgreSQL, and Docker.',
    requirements: [
      'Strong solution architecture fundamentals',
      'Experience with ERP, accounting, or CRM products',
      'Security-first development practices'
    ],
    skills: ['NestJS', 'MongoDB', 'PostgreSQL', 'Docker', 'Solution Architecture', 'Secure Coding'],
    minExperienceYears: 5,
    seniority: 'senior'
  },
  {
    externalId: 'mock-backend-004',
    title: 'Senior Backend Engineer (Node.js)',
    company: 'CivicScale',
    location: 'Remote, Canada',
    remote: true,
    employmentType: 'Contract',
    url: 'https://example.com/jobs/mock-backend-004',
    description:
      'Build backend modules for a digital governance platform. Focus on Node.js, NestJS, PostgreSQL, reporting APIs, and role-based permissions. Prior board-management product experience is a plus.',
    requirements: [
      'Deep Node.js and NestJS expertise',
      'Relational database design and reporting APIs',
      'Experience with enterprise reporting or governance tools'
    ],
    skills: ['Node.js', 'NestJS', 'PostgreSQL', 'REST APIs', 'Reporting'],
    minExperienceYears: 4,
    seniority: 'senior'
  },
  {
    externalId: 'mock-mobile-005',
    title: 'Senior iOS Engineer',
    company: 'PocketHealth',
    location: 'Remote',
    remote: true,
    employmentType: 'Full-time',
    url: 'https://example.com/jobs/mock-mobile-005',
    description:
      'Ship native iOS features in Swift, maintain mobile CI pipelines, and optimize mobile UX for healthcare customers.',
    requirements: [
      '5+ years of native iOS development',
      'Strong Swift and UIKit experience'
    ],
    skills: ['Swift', 'iOS', 'UIKit'],
    minExperienceYears: 5,
    seniority: 'senior'
  },
  {
    externalId: 'mock-security-006',
    title: 'Application Security Engineer',
    company: 'ShieldOps',
    location: 'Remote',
    remote: true,
    employmentType: 'Full-time',
    url: 'https://example.com/jobs/mock-security-006',
    description:
      'Run secure coding reviews, OWASP-based assessments, and vulnerability remediation programs across Node.js and PHP systems in Azure.',
    requirements: [
      'Practical security auditing experience',
      'Knowledge of OWASP and secure coding standards',
      'Comfort working with development teams'
    ],
    skills: ['Security Auditing', 'OWASP', 'Secure Coding', 'Node.js', 'PHP', 'Azure'],
    minExperienceYears: 4,
    seniority: 'senior'
  }
];

