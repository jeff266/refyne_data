/**
 * Demo Fixtures for Arrangements
 *
 * Hardcoded demo companies for testing arrangements in demo mode.
 * These are used for rehearsal runs without consuming credits.
 */

export interface DemoCompany {
  id: string;
  name: string;
  domain: string;
  employee_count?: number;
  industry?: string;
  linkedin_url?: string;
}

/**
 * 10 demo companies for testing enrichment arrangements.
 */
export const DEMO_COMPANIES: DemoCompany[] = [
  {
    id: 'demo-1',
    name: 'Acme Corporation',
    domain: 'acme.com',
    employee_count: 1500,
    industry: 'Technology',
    linkedin_url: 'https://linkedin.com/company/acme',
  },
  {
    id: 'demo-2',
    name: 'TechStart Inc',
    domain: 'techstart.io',
    employee_count: 50,
    industry: 'Software',
    linkedin_url: 'https://linkedin.com/company/techstart',
  },
  {
    id: 'demo-3',
    name: 'Global Industries',
    domain: 'globalind.com',
    employee_count: 5000,
    industry: 'Manufacturing',
    linkedin_url: 'https://linkedin.com/company/global-industries',
  },
  {
    id: 'demo-4',
    name: 'Innovate Labs',
    domain: 'innovatelabs.ai',
    employee_count: 120,
    industry: 'Artificial Intelligence',
    linkedin_url: 'https://linkedin.com/company/innovate-labs',
  },
  {
    id: 'demo-5',
    name: 'CloudScale Systems',
    domain: 'cloudscale.com',
    employee_count: 800,
    industry: 'Cloud Computing',
    linkedin_url: 'https://linkedin.com/company/cloudscale',
  },
  {
    id: 'demo-6',
    name: 'DataFlow Analytics',
    domain: 'dataflow.io',
    employee_count: 250,
    industry: 'Data Analytics',
    linkedin_url: 'https://linkedin.com/company/dataflow-analytics',
  },
  {
    id: 'demo-7',
    name: 'SecureNet Solutions',
    domain: 'securenet.com',
    employee_count: 450,
    industry: 'Cybersecurity',
    linkedin_url: 'https://linkedin.com/company/securenet',
  },
  {
    id: 'demo-8',
    name: 'GreenTech Energy',
    domain: 'greentech-energy.com',
    employee_count: 2000,
    industry: 'Renewable Energy',
    linkedin_url: 'https://linkedin.com/company/greentech-energy',
  },
  {
    id: 'demo-9',
    name: 'FinanceHub',
    domain: 'financehub.com',
    employee_count: 350,
    industry: 'Financial Services',
    linkedin_url: 'https://linkedin.com/company/financehub',
  },
  {
    id: 'demo-10',
    name: 'HealthPlus Medical',
    domain: 'healthplus.com',
    employee_count: 1200,
    industry: 'Healthcare',
    linkedin_url: 'https://linkedin.com/company/healthplus',
  },
];

/**
 * Get demo enrichment result for a given company and provider.
 * Returns synthetic data based on company profile.
 */
export function getDemoEnrichmentResult(
  company: DemoCompany,
  provider: string,
  fields: string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const field of fields) {
    switch (field) {
      case 'domain':
        result.domain = company.domain;
        break;
      case 'employee_count':
        result.employee_count = company.employee_count || Math.floor(Math.random() * 1000) + 50;
        break;
      case 'industry':
        result.industry = company.industry || 'Technology';
        break;
      case 'linkedin_url':
        result.linkedin_url = company.linkedin_url || `https://linkedin.com/company/${company.name.toLowerCase().replace(/\s+/g, '-')}`;
        break;
      case 'founded_year':
        result.founded_year = 2000 + Math.floor(Math.random() * 23);
        break;
      case 'revenue':
        result.revenue = (company.employee_count || 100) * 100000; // $100k per employee estimate
        break;
      case 'location':
        result.location = ['San Francisco, CA', 'New York, NY', 'Austin, TX', 'Boston, MA', 'Seattle, WA'][Math.floor(Math.random() * 5)];
        break;
      case 'technologies':
        result.technologies = ['React', 'Node.js', 'PostgreSQL', 'AWS', 'Docker'].slice(0, 3);
        break;
      case 'funding_stage':
        result.funding_stage = ['Seed', 'Series A', 'Series B', 'Series C', 'Public'][Math.floor(Math.random() * 5)];
        break;
      case 'phone':
        result.phone = `+1-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`;
        break;
      default:
        // Generic field - return company name-based value
        result[field] = `${company.name} - ${field}`;
    }
  }

  return result;
}

/**
 * Simulate enrichment delay (for demo mode).
 * Returns a promise that resolves after a short delay.
 */
export async function simulateEnrichmentDelay(recordCount: number): Promise<void> {
  // 50-150ms per record to simulate API calls
  const delay = Math.min(3000, recordCount * (50 + Math.random() * 100));
  await new Promise(resolve => setTimeout(resolve, delay));
}
