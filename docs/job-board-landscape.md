# Job Board Landscape

This project should evolve like an opportunity-intelligence platform, not a single monolithic scraper. The practical way to scale is to separate sources into four lanes:

1. ATS platforms with public job APIs
2. ATS platforms with customer or partner-only APIs/feeds
3. Hosted career sites that need source-specific parsing
4. Aggregators that should not be scraped without permission

## Highest-value connectors

These are the first connectors worth implementing because they are the cleanest and most reusable:

- Greenhouse Job Board API
- Lever Postings API
- Ashby Job Postings API
- Oracle Taleo public career sections
- Jobvite hosted career sites

## Good but credentialed

These are strong targets when an employer or partner gives access:

- SmartRecruiters Posting API
- Workable Jobs API
- Teamtailor API / XML feeds
- Recruitee Careers Site API
- Personio Recruiting API / XML
- iCIMS Job Portal API / XML feeds

## Avoid scraping directly

These boards are strategically important but should not be treated as default scraping targets because their own policies are restrictive:

- LinkedIn
- Indeed
- Glassdoor

## Product direction inspired by OpenTenderHub

The main design lesson from OpenTenderHub is not just aggregation. It is operationalizing source monitoring:

- source registry with metadata and health
- normalized opportunity schema
- scheduled scans
- AI relevance scoring
- user-specific alerts
- tracked source coverage and failures

For this project, the next sensible build steps are:

1. Add a source-catalog endpoint and show it in the Angular dashboard
2. Implement Ashby connector
3. Add hosted-site parsers for Taleo and Jobvite
4. Add a queue plus run logs per source
5. Add user accounts and per-user match materialization
