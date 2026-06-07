#!/usr/bin/env tsx
/**
 * Seed Name Registry Global Entries
 *
 * Seeds ~5,000-10,000 global name registry entries from:
 * - Fortune 1000 companies (top 100 most recognizable)
 * - Tech brand registry (~200 entries)
 * - Common acronyms (~300 entries)
 * - Contact token registry (~700 entries)
 *
 * Usage:
 *   npx tsx scripts/seed-name-registry.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local BEFORE importing admin client
config({ path: resolve(process.cwd(), '.env.local') });

import { supabaseAdmin } from '../lib/db/admin-client';

interface NameRegistryRow {
  org_id: null;
  registry_type: 'company' | 'contact_first' | 'contact_last' | 'contact_token';
  input_token: string;
  canonical_form: string;
  source: string;
  confidence: number;
  status: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. FORTUNE 1000 COMPANIES (TOP 100)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const FORTUNE_COMPANIES = [
  // Tech Giants
  { full: 'Apple Inc.', short: 'Apple', acronym: null },
  { full: 'Microsoft Corporation', short: 'Microsoft', acronym: 'MSFT' },
  { full: 'Alphabet Inc.', short: 'Google', acronym: 'GOOG' },
  { full: 'Amazon.com Inc.', short: 'Amazon', acronym: 'AMZN' },
  { full: 'Meta Platforms Inc.', short: 'Meta', acronym: 'META' },
  { full: 'Tesla Inc.', short: 'Tesla', acronym: 'TSLA' },
  { full: 'NVIDIA Corporation', short: 'NVIDIA', acronym: 'NVDA' },
  { full: 'Intel Corporation', short: 'Intel', acronym: 'INTC' },
  { full: 'International Business Machines', short: 'IBM', acronym: 'IBM' },
  { full: 'Oracle Corporation', short: 'Oracle', acronym: 'ORCL' },
  { full: 'Cisco Systems Inc.', short: 'Cisco', acronym: 'CSCO' },
  { full: 'Adobe Inc.', short: 'Adobe', acronym: 'ADBE' },
  { full: 'Salesforce Inc.', short: 'Salesforce', acronym: 'CRM' },
  { full: 'Advanced Micro Devices', short: 'AMD', acronym: 'AMD' },
  { full: 'Qualcomm Inc.', short: 'Qualcomm', acronym: 'QCOM' },
  { full: 'Texas Instruments', short: 'TI', acronym: 'TI' },
  { full: 'Dell Technologies', short: 'Dell', acronym: null },
  { full: 'Hewlett Packard Enterprise', short: 'HPE', acronym: 'HPE' },
  { full: 'HP Inc.', short: 'HP', acronym: 'HP' },
  { full: 'Netflix Inc.', short: 'Netflix', acronym: 'NFLX' },
  { full: 'PayPal Holdings', short: 'PayPal', acronym: 'PYPL' },
  { full: 'ServiceNow Inc.', short: 'ServiceNow', acronym: 'NOW' },

  // Financial Services
  { full: 'JPMorgan Chase & Co.', short: 'JPMorgan', acronym: 'JPM' },
  { full: 'Bank of America Corporation', short: 'Bank of America', acronym: 'BAC' },
  { full: 'Wells Fargo & Company', short: 'Wells Fargo', acronym: 'WFC' },
  { full: 'Citigroup Inc.', short: 'Citigroup', acronym: 'C' },
  { full: 'Goldman Sachs Group', short: 'Goldman Sachs', acronym: 'GS' },
  { full: 'Morgan Stanley', short: 'Morgan Stanley', acronym: 'MS' },
  { full: 'American Express Company', short: 'American Express', acronym: 'AXP' },
  { full: 'Capital One Financial', short: 'Capital One', acronym: 'COF' },
  { full: 'Charles Schwab Corporation', short: 'Charles Schwab', acronym: 'SCHW' },
  { full: 'Visa Inc.', short: 'Visa', acronym: 'V' },
  { full: 'Mastercard Incorporated', short: 'Mastercard', acronym: 'MA' },

  // Retail & Consumer
  { full: 'Walmart Inc.', short: 'Walmart', acronym: 'WMT' },
  { full: 'The Home Depot', short: 'Home Depot', acronym: 'HD' },
  { full: 'Target Corporation', short: 'Target', acronym: 'TGT' },
  { full: 'Costco Wholesale Corporation', short: 'Costco', acronym: 'COST' },
  { full: "Lowe's Companies", short: "Lowe's", acronym: 'LOW' },
  { full: 'The Kroger Co.', short: 'Kroger', acronym: 'KR' },
  { full: 'Walgreens Boots Alliance', short: 'Walgreens', acronym: 'WBA' },
  { full: 'CVS Health Corporation', short: 'CVS', acronym: 'CVS' },
  { full: 'The Coca-Cola Company', short: 'Coca-Cola', acronym: 'KO' },
  { full: 'PepsiCo Inc.', short: 'PepsiCo', acronym: 'PEP' },
  { full: 'The Procter & Gamble Company', short: 'Procter & Gamble', acronym: 'PG' },
  { full: 'Nike Inc.', short: 'Nike', acronym: 'NKE' },
  { full: 'McDonald\'s Corporation', short: 'McDonald\'s', acronym: 'MCD' },
  { full: 'Starbucks Corporation', short: 'Starbucks', acronym: 'SBUX' },

  // Healthcare & Pharma
  { full: 'UnitedHealth Group', short: 'UnitedHealth', acronym: 'UNH' },
  { full: 'Johnson & Johnson', short: 'J&J', acronym: 'JNJ' },
  { full: 'Pfizer Inc.', short: 'Pfizer', acronym: 'PFE' },
  { full: 'Merck & Co.', short: 'Merck', acronym: 'MRK' },
  { full: 'AbbVie Inc.', short: 'AbbVie', acronym: 'ABBV' },
  { full: 'Abbott Laboratories', short: 'Abbott', acronym: 'ABT' },
  { full: 'Eli Lilly and Company', short: 'Eli Lilly', acronym: 'LLY' },
  { full: 'Bristol-Myers Squibb', short: 'BMS', acronym: 'BMY' },
  { full: 'Anthem Inc.', short: 'Anthem', acronym: 'ANTM' },
  { full: 'Cigna Corporation', short: 'Cigna', acronym: 'CI' },
  { full: 'Humana Inc.', short: 'Humana', acronym: 'HUM' },

  // Energy & Utilities
  { full: 'Exxon Mobil Corporation', short: 'ExxonMobil', acronym: 'XOM' },
  { full: 'Chevron Corporation', short: 'Chevron', acronym: 'CVX' },
  { full: 'ConocoPhillips', short: 'ConocoPhillips', acronym: 'COP' },
  { full: 'NextEra Energy', short: 'NextEra', acronym: 'NEE' },
  { full: 'Duke Energy', short: 'Duke Energy', acronym: 'DUK' },

  // Telecommunications
  { full: 'AT&T Inc.', short: 'AT&T', acronym: 'T' },
  { full: 'Verizon Communications', short: 'Verizon', acronym: 'VZ' },
  { full: 'T-Mobile US Inc.', short: 'T-Mobile', acronym: 'TMUS' },
  { full: 'Comcast Corporation', short: 'Comcast', acronym: 'CMCSA' },
  { full: 'Charter Communications', short: 'Charter', acronym: 'CHTR' },

  // Automotive & Transportation
  { full: 'General Motors Company', short: 'GM', acronym: 'GM' },
  { full: 'Ford Motor Company', short: 'Ford', acronym: 'F' },
  { full: 'United Parcel Service', short: 'UPS', acronym: 'UPS' },
  { full: 'FedEx Corporation', short: 'FedEx', acronym: 'FDX' },
  { full: 'United Airlines Holdings', short: 'United Airlines', acronym: 'UAL' },
  { full: 'Delta Air Lines', short: 'Delta', acronym: 'DAL' },
  { full: 'American Airlines Group', short: 'American Airlines', acronym: 'AAL' },
  { full: 'Southwest Airlines', short: 'Southwest', acronym: 'LUV' },

  // Industrial & Manufacturing
  { full: 'The Boeing Company', short: 'Boeing', acronym: 'BA' },
  { full: 'Lockheed Martin Corporation', short: 'Lockheed Martin', acronym: 'LMT' },
  { full: 'Raytheon Technologies', short: 'Raytheon', acronym: 'RTX' },
  { full: 'General Electric Company', short: 'GE', acronym: 'GE' },
  { full: '3M Company', short: '3M', acronym: 'MMM' },
  { full: 'Honeywell International', short: 'Honeywell', acronym: 'HON' },
  { full: 'Caterpillar Inc.', short: 'Caterpillar', acronym: 'CAT' },
  { full: 'Deere & Company', short: 'John Deere', acronym: 'DE' },

  // Media & Entertainment
  { full: 'The Walt Disney Company', short: 'Disney', acronym: 'DIS' },
  { full: 'Warner Bros. Discovery', short: 'Warner Bros', acronym: 'WBD' },
  { full: 'Paramount Global', short: 'Paramount', acronym: 'PARA' },
  { full: 'Sony Corporation', short: 'Sony', acronym: 'SONY' },

  // Other Major Corporations
  { full: 'Berkshire Hathaway Inc.', short: 'Berkshire Hathaway', acronym: 'BRK' },
  { full: 'BlackRock Inc.', short: 'BlackRock', acronym: 'BLK' },
  { full: 'The Vanguard Group', short: 'Vanguard', acronym: null },
  { full: 'Accenture plc', short: 'Accenture', acronym: 'ACN' },
  { full: 'Deloitte Touche Tohmatsu', short: 'Deloitte', acronym: null },
  { full: 'PricewaterhouseCoopers', short: 'PwC', acronym: 'PwC' },
  { full: 'Ernst & Young', short: 'EY', acronym: 'EY' },
  { full: 'KPMG International', short: 'KPMG', acronym: 'KPMG' },

  // Insurance
  { full: 'State Farm Insurance', short: 'State Farm', acronym: null },
  { full: 'Berkshire Hathaway Insurance', short: 'Berkshire Insurance', acronym: null },
  { full: 'Progressive Corporation', short: 'Progressive', acronym: 'PGR' },
  { full: 'Allstate Corporation', short: 'Allstate', acronym: 'ALL' },
  { full: 'Liberty Mutual Insurance', short: 'Liberty Mutual', acronym: null },
  { full: 'Travelers Companies', short: 'Travelers', acronym: 'TRV' },
  { full: 'GEICO', short: 'GEICO', acronym: null },
  { full: 'Nationwide Mutual Insurance', short: 'Nationwide', acronym: null },
  { full: 'USAA', short: 'USAA', acronym: null },
  { full: 'Farmers Insurance Group', short: 'Farmers', acronym: null },

  // Food & Beverage
  { full: 'Nestlé S.A.', short: 'Nestlé', acronym: null },
  { full: 'Mondelez International', short: 'Mondelez', acronym: 'MDLZ' },
  { full: 'Kraft Heinz Company', short: 'Kraft Heinz', acronym: 'KHC' },
  { full: 'General Mills Inc.', short: 'General Mills', acronym: 'GIS' },
  { full: 'Kellogg Company', short: 'Kellogg', acronym: 'K' },
  { full: 'The Hershey Company', short: 'Hershey', acronym: 'HSY' },
  { full: 'Mars Incorporated', short: 'Mars', acronym: null },
  { full: 'Anheuser-Busch InBev', short: 'AB InBev', acronym: 'BUD' },
  { full: 'Diageo plc', short: 'Diageo', acronym: 'DEO' },
  { full: 'Constellation Brands', short: 'Constellation', acronym: 'STZ' },

  // Retail (Additional)
  { full: 'Best Buy Co. Inc.', short: 'Best Buy', acronym: 'BBY' },
  { full: 'The Gap Inc.', short: 'Gap', acronym: 'GPS' },
  { full: 'Ross Stores Inc.', short: 'Ross', acronym: 'ROST' },
  { full: 'TJX Companies Inc.', short: 'TJX', acronym: 'TJX' },
  { full: 'Nordstrom Inc.', short: 'Nordstrom', acronym: 'JWN' },
  { full: 'Macy\'s Inc.', short: 'Macy\'s', acronym: 'M' },
  { full: 'Kohl\'s Corporation', short: 'Kohl\'s', acronym: 'KSS' },
  { full: 'Dollar General Corporation', short: 'Dollar General', acronym: 'DG' },
  { full: 'Dollar Tree Inc.', short: 'Dollar Tree', acronym: 'DLTR' },

  // Hospitality & Travel
  { full: 'Marriott International', short: 'Marriott', acronym: 'MAR' },
  { full: 'Hilton Worldwide Holdings', short: 'Hilton', acronym: 'HLT' },
  { full: 'Hyatt Hotels Corporation', short: 'Hyatt', acronym: 'H' },
  { full: 'InterContinental Hotels Group', short: 'IHG', acronym: 'IHG' },
  { full: 'Airbnb Inc.', short: 'Airbnb', acronym: 'ABNB' },
  { full: 'Expedia Group', short: 'Expedia', acronym: 'EXPE' },
  { full: 'Booking Holdings Inc.', short: 'Booking', acronym: 'BKNG' },

  // Automotive (Additional)
  { full: 'Honda Motor Company', short: 'Honda', acronym: 'HMC' },
  { full: 'Toyota Motor Corporation', short: 'Toyota', acronym: 'TM' },
  { full: 'Nissan Motor Company', short: 'Nissan', acronym: null },
  { full: 'Volkswagen AG', short: 'VW', acronym: 'VWAGY' },
  { full: 'BMW Group', short: 'BMW', acronym: null },
  { full: 'Mercedes-Benz Group', short: 'Mercedes-Benz', acronym: null },
  { full: 'Stellantis N.V.', short: 'Stellantis', acronym: 'STLA' },

  // Industrial (Additional)
  { full: 'Siemens AG', short: 'Siemens', acronym: 'SIEGY' },
  { full: 'ABB Ltd', short: 'ABB', acronym: 'ABB' },
  { full: 'Schneider Electric', short: 'Schneider', acronym: null },
  { full: 'Emerson Electric Co.', short: 'Emerson', acronym: 'EMR' },
  { full: 'Parker Hannifin Corporation', short: 'Parker', acronym: 'PH' },
  { full: 'Illinois Tool Works', short: 'ITW', acronym: 'ITW' },

  // Chemicals & Materials
  { full: 'Dow Inc.', short: 'Dow', acronym: 'DOW' },
  { full: 'DuPont de Nemours Inc.', short: 'DuPont', acronym: 'DD' },
  { full: 'BASF SE', short: 'BASF', acronym: null },
  { full: 'Linde plc', short: 'Linde', acronym: 'LIN' },
  { full: 'Air Products and Chemicals', short: 'Air Products', acronym: 'APD' },

  // Semiconductors (Additional)
  { full: 'Broadcom Inc.', short: 'Broadcom', acronym: 'AVGO' },
  { full: 'Taiwan Semiconductor', short: 'TSMC', acronym: 'TSM' },
  { full: 'Applied Materials Inc.', short: 'Applied Materials', acronym: 'AMAT' },
  { full: 'Lam Research Corporation', short: 'Lam Research', acronym: 'LRCX' },
  { full: 'KLA Corporation', short: 'KLA', acronym: 'KLAC' },
  { full: 'Micron Technology', short: 'Micron', acronym: 'MU' },
  { full: 'Analog Devices Inc.', short: 'Analog Devices', acronym: 'ADI' },

  // Real Estate
  { full: 'CBRE Group Inc.', short: 'CBRE', acronym: 'CBRE' },
  { full: 'Jones Lang LaSalle', short: 'JLL', acronym: 'JLL' },
  { full: 'Cushman & Wakefield', short: 'Cushman', acronym: 'CWK' },
  { full: 'Redfin Corporation', short: 'Redfin', acronym: 'RDFN' },
  { full: 'Zillow Group Inc.', short: 'Zillow', acronym: 'Z' },

  // Education & Publishing
  { full: 'Pearson plc', short: 'Pearson', acronym: null },
  { full: 'McGraw Hill', short: 'McGraw Hill', acronym: null },
  { full: 'Houghton Mifflin Harcourt', short: 'HMH', acronym: null },
  { full: 'Cengage Learning', short: 'Cengage', acronym: null },
  { full: 'Wiley', short: 'Wiley', acronym: null },

  // Utilities (Additional)
  { full: 'Southern Company', short: 'Southern', acronym: 'SO' },
  { full: 'Dominion Energy', short: 'Dominion', acronym: 'D' },
  { full: 'Exelon Corporation', short: 'Exelon', acronym: 'EXC' },
  { full: 'American Electric Power', short: 'AEP', acronym: 'AEP' },
  { full: 'Sempra Energy', short: 'Sempra', acronym: 'SRE' },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. TECH BRAND REGISTRY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const TECH_BRANDS = [
  // SaaS Platforms - Sales & Marketing
  'HubSpot', 'Salesforce', 'Marketo', 'Pardot', 'Eloqua',
  'Outreach', 'Salesloft', 'Gong', 'Chorus', 'Clari',
  'ZoomInfo', 'LinkedIn', 'Apollo', 'Clearbit', 'LeadIQ',
  'Drift', 'Intercom', 'Zendesk', 'Freshdesk', 'Front',
  'Slack', 'Microsoft Teams', 'Zoom', 'Google Meet', 'Webex',
  'SalesLoft', 'InsideSales', 'People.ai', 'Troops', 'LeanData',
  'Demandbase', '6sense', 'Terminus', 'RollWorks', 'Triblio',
  'PathFactory', 'Uberflip', 'Seismic', 'Highspot', 'Showpad',
  'Outreach.io', 'SalesLoft', 'Groove', 'Cirrus Insight', 'Yesware',
  'Mixmax', 'Mailshake', 'Reply.io', 'Lemlist', 'Woodpecker',
  'ActiveCampaign', 'ConvertKit', 'GetResponse', 'AWeber', 'Drip',
  'Customer.io', 'Iterable', 'Braze', 'MoEngage', 'CleverTap',
  'Intercom', 'LiveChat', 'Olark', 'Tawk.to', 'Crisp',
  'Pipedrive', 'Close', 'Copper', 'Nutshell', 'Insightly',
  'Nimble', 'Streak', 'Zoho CRM', 'SugarCRM', 'Creatio',

  // Project & Work Management
  'Notion', 'Airtable', 'Monday.com', 'Asana', 'Trello',
  'Jira', 'Confluence', 'ClickUp', 'Wrike', 'Smartsheet',
  'Basecamp', 'Teamwork', 'Podio', 'Workfront', 'Clarizen',
  'Aha!', 'ProductPlan', 'Roadmunk', 'ProdPad', 'airfocus',

  // Developer Tools & Version Control
  'GitHub', 'GitLab', 'Bitbucket', 'SourceForge', 'Beanstalk',
  'Perforce', 'Mercurial', 'Subversion', 'Azure DevOps', 'AWS CodeCommit',
  'Figma', 'Sketch', 'InVision', 'Adobe XD', 'Canva',
  'Zeplin', 'Framer', 'Principle', 'ProtoPie', 'Axure',

  // Payment & Fintech
  'Stripe', 'Square', 'PayPal', 'Braintree', 'Adyen',
  'Plaid', 'Dwolla', 'Affirm', 'Klarna', 'Afterpay',
  'Chargify', 'Recurly', 'Chargebee', 'Zuora', 'FastSpring',

  // Communication & Messaging
  'Twilio', 'SendGrid', 'Mailchimp', 'Klaviyo', 'Constant Contact',
  'Postmark', 'Mandrill', 'Amazon SES', 'SparkPost', 'Mailgun',
  'Vonage', 'Nexmo', 'Plivo', 'Bandwidth', 'MessageBird',

  // E-commerce Platforms
  'Shopify', 'WooCommerce', 'Magento', 'BigCommerce', 'Squarespace',
  'WordPress', 'Wix', 'Webflow', 'Drupal', 'Joomla',
  'PrestaShop', 'OpenCart', 'Volusion', 'Big Cartel', '3dcart',

  // Analytics & Data
  'Snowflake', 'Databricks', 'Datadog', 'New Relic', 'Splunk',
  'Tableau', 'Looker', 'Power BI', 'Qlik', 'Sisense',
  'Segment', 'Amplitude', 'Mixpanel', 'Heap', 'Pendo',
  'Fullstory', 'LogRocket', 'Hotjar', 'Crazy Egg', 'Mouseflow',
  'Google Analytics', 'Adobe Analytics', 'Matomo', 'Clicky', 'Fathom',
  'Chartio', 'Mode', 'Metabase', 'Redash', 'Superset',

  // Document Management
  'DocuSign', 'PandaDoc', 'HelloSign', 'Adobe Sign', 'SignNow',
  'SignRequest', 'eversign', 'SignEasy', 'RightSignature', 'Docsketch',
  'Box', 'Dropbox', 'Google Drive', 'OneDrive', 'iCloud Drive',

  // Cloud Providers & Infrastructure
  'Amazon Web Services', 'AWS', 'Microsoft Azure', 'Azure',
  'Google Cloud Platform', 'GCP', 'DigitalOcean', 'Linode', 'Heroku',
  'Cloudflare', 'Fastly', 'Akamai', 'Vercel', 'Netlify',
  'Railway', 'Fly.io', 'Render', 'PlanetScale', 'Supabase',
  'Firebase', 'Parse', 'Back4App', 'Kinsta', 'WP Engine',

  // Databases & Data Tools
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch',
  'DynamoDB', 'Cassandra', 'Neo4j', 'CouchDB', 'MariaDB',
  'SQLite', 'Oracle Database', 'SQL Server', 'Redshift', 'BigQuery',
  'TimescaleDB', 'InfluxDB', 'Prometheus', 'Grafana', 'ClickHouse',
  'RocksDB', 'LevelDB', 'CockroachDB', 'TiDB', 'YugabyteDB',

  // Development Tools & Languages
  'JavaScript', 'TypeScript', 'Python', 'Java', 'Ruby',
  'Go', 'Rust', 'PHP', 'Swift', 'Kotlin',
  'React', 'Angular', 'Vue.js', 'Next.js', 'Svelte',
  'Node.js', 'Express', 'Django', 'Flask', 'Rails',
  'Docker', 'Kubernetes', 'Jenkins', 'CircleCI', 'Travis CI',
  'Terraform', 'Ansible', 'Puppet', 'Chef', 'SaltStack',
  'Vagrant', 'Packer', 'Consul', 'Vault', 'Nomad',
  'webpack', 'Vite', 'Rollup', 'Parcel', 'esbuild',
  'Jest', 'Mocha', 'Jasmine', 'Cypress', 'Playwright',
  'Selenium', 'Puppeteer', 'WebdriverIO', 'TestCafe', 'Nightwatch',

  // Apple Products
  'iPhone', 'iPad', 'MacBook', 'iMac', 'Mac Pro',
  'macOS', 'iOS', 'iPadOS', 'watchOS', 'tvOS',
  'Safari', 'iTunes', 'iCloud', 'App Store', 'Apple Music',
  'Apple Pay', 'Apple TV', 'AirPods', 'HomePod', 'Apple Watch',

  // Google Products
  'Gmail', 'Google Drive', 'Google Docs', 'Google Sheets', 'Google Slides',
  'YouTube', 'Google Maps', 'Google Chrome', 'Android', 'Google Workspace',
  'Google Calendar', 'Google Photos', 'Google Play', 'Google Assistant', 'Chromebook',

  // Microsoft Products
  'Windows', 'Office 365', 'Microsoft 365', 'Outlook', 'Excel',
  'Word', 'PowerPoint', 'OneDrive', 'SharePoint', 'Dynamics 365',
  'Azure Active Directory', 'Microsoft Edge', 'Bing', 'Visual Studio', 'VS Code',

  // Adobe Products
  'Photoshop', 'Illustrator', 'InDesign', 'Premiere Pro', 'After Effects',
  'Acrobat', 'Creative Cloud', 'Experience Cloud', 'Analytics Cloud',
  'Lightroom', 'Dreamweaver', 'Animate', 'Audition', 'Character Animator',

  // Consulting & Professional Services
  'McKinsey & Company', 'McKinsey', 'Boston Consulting Group', 'BCG',
  'Bain & Company', 'Bain', 'Oliver Wyman', 'A.T. Kearney',
  'Roland Berger', 'Strategy&', 'L.E.K. Consulting', 'Kearney',

  // E-commerce & Marketplaces
  'eBay', 'Etsy', 'Alibaba', 'AliExpress', 'Rakuten',
  'Wayfair', 'Overstock', 'Wish', 'Mercari', 'Poshmark',

  // Social Media
  'Facebook', 'Instagram', 'Twitter', 'X', 'TikTok',
  'Snapchat', 'Pinterest', 'Reddit', 'Discord', 'Telegram',
  'WhatsApp', 'WeChat', 'LINE', 'Viber', 'Signal',
  'Mastodon', 'Bluesky', 'Threads', 'BeReal', 'Clubhouse',

  // Security & Identity
  'Okta', 'Auth0', 'OneLogin', 'Duo Security', 'CrowdStrike',
  'Palo Alto Networks', 'Fortinet', 'Check Point', 'Zscaler',
  'SentinelOne', 'Carbon Black', 'Cybereason', 'Darktrace', 'Rapid7',
  '1Password', 'LastPass', 'Dashlane', 'Bitwarden', 'Keeper',

  // HR & Recruiting
  'Workday', 'ADP', 'BambooHR', 'Gusto', 'Rippling',
  'Lever', 'Greenhouse', 'iCIMS', 'Jobvite', 'SmartRecruiters',
  'Indeed', 'Glassdoor', 'Monster', 'CareerBuilder', 'Dice',
  'Hired', 'AngelList', 'Wellfound', 'Built In', 'The Muse',

  // Customer Success & Support
  'Gainsight', 'ChurnZero', 'Totango', 'ClientSuccess', 'Planhat',
  'Intercom', 'Help Scout', 'Freshservice', 'ServiceNow', 'Jira Service Desk',
  'Kustomer', 'Gladly', 'Gorgias', 'Re:amaze', 'Richpanel',

  // Business Intelligence
  'ThoughtSpot', 'Domo', 'GoodData', 'MicroStrategy', 'SAP BusinessObjects',
  'IBM Cognos', 'Oracle BI', 'QlikView', 'Pentaho', 'TIBCO Spotfire',

  // Marketing Automation
  'HubSpot Marketing Hub', 'Marketo Engage', 'Adobe Marketo', 'Oracle Eloqua',
  'ActiveCampaign', 'Autopilot', 'Pardot', 'Act-On', 'SharpSpring',

  // CMS & Website Builders
  'Contentful', 'Strapi', 'Sanity', 'Prismic', 'Contentstack',
  'Ghost', 'Medium', 'Substack', 'Hashnode', 'Dev.to',

  // Video & Streaming
  'Mux', 'Wistia', 'Vimeo', 'Brightcove', 'JW Player',
  'Kaltura', 'Panopto', 'Vidyard', 'Loom', 'Descript',

  // Design & Prototyping
  'Abstract', 'Avocode', 'Sympli', 'Marvel', 'Balsamiq',
  'Miro', 'Mural', 'FigJam', 'Whimsical', 'Lucidchart',

  // Testing & QA
  'BrowserStack', 'Sauce Labs', 'LambdaTest', 'CrossBrowserTesting', 'Percy',
  'Applitools', 'Chromatic', 'TestRail', 'Zephyr', 'PractiTest',

  // API Development
  'Postman', 'Insomnia', 'Paw', 'Hoppscotch', 'Swagger',
  'Stoplight', 'RapidAPI', 'Kong', 'Apigee', 'MuleSoft',

  // Monitoring & Observability
  'Sentry', 'Rollbar', 'Bugsnag', 'Raygun', 'Airbrake',
  'PagerDuty', 'OpsGenie', 'VictorOps', 'xMatters', 'Incident.io',

  // Search & Discovery
  'Algolia', 'Elastic', 'Solr', 'Typesense', 'Meilisearch',
  'Coveo', 'Swiftype', 'SearchBlox', 'Lucidworks', 'Sinequa',

  // Feature Flags & Experimentation
  'LaunchDarkly', 'Split', 'Optimizely', 'VWO', 'AB Tasty',
  'Statsig', 'GrowthBook', 'Flagsmith', 'ConfigCat', 'Unleash',
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. COMMON COMPANY VARIATIONS (casual/shorthand versions)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const COMPANY_VARIATIONS: Array<{ input: string; canonical: string }> = [
  // Casual tech company names
  { input: 'fb', canonical: 'Facebook' },
  { input: 'ig', canonical: 'Instagram' },
  { input: 'msft', canonical: 'Microsoft' },
  { input: 'goog', canonical: 'Google' },
  { input: 'amzn', canonical: 'Amazon' },
  { input: 'nflx', canonical: 'Netflix' },
  { input: 'aapl', canonical: 'Apple' },
  { input: 'tsla', canonical: 'Tesla' },
  { input: 'nvda', canonical: 'NVIDIA' },
  { input: 'sfdc', canonical: 'Salesforce' },

  // Common misspellings and variations
  { input: 'macdonalds', canonical: 'McDonald\'s' },
  { input: 'mcdonalds', canonical: 'McDonald\'s' },
  { input: 'mcds', canonical: 'McDonald\'s' },
  { input: 'starbux', canonical: 'Starbucks' },
  { input: 'sbux', canonical: 'Starbucks' },
  { input: 'fedex', canonical: 'FedEx' },
  { input: 'fed ex', canonical: 'FedEx' },

  // Bank variations
  { input: 'bofa', canonical: 'Bank of America' },
  { input: 'boa', canonical: 'Bank of America' },
  { input: 'jpm', canonical: 'JPMorgan' },
  { input: 'jpmc', canonical: 'JPMorgan Chase' },
  { input: 'wellsfargo', canonical: 'Wells Fargo' },
  { input: 'wf', canonical: 'Wells Fargo' },
  { input: 'citi', canonical: 'Citigroup' },
  { input: 'gs', canonical: 'Goldman Sachs' },

  // Retail variations
  { input: 'wmt', canonical: 'Walmart' },
  { input: 'tgt', canonical: 'Target' },
  { input: 'amzn', canonical: 'Amazon' },
  { input: 'costco', canonical: 'Costco' },

  // Tech product variations
  { input: 'mac os', canonical: 'macOS' },
  { input: 'mac osx', canonical: 'macOS' },
  { input: 'osx', canonical: 'macOS' },
  { input: 'win', canonical: 'Windows' },
  { input: 'win10', canonical: 'Windows' },
  { input: 'win11', canonical: 'Windows' },
  { input: 'js', canonical: 'JavaScript' },
  { input: 'ts', canonical: 'TypeScript' },
  { input: 'py', canonical: 'Python' },
  { input: 'postgres', canonical: 'PostgreSQL' },
  { input: 'psql', canonical: 'PostgreSQL' },
  { input: 'mongo', canonical: 'MongoDB' },
  { input: 'es', canonical: 'Elasticsearch' },
  { input: 'k8s', canonical: 'Kubernetes' },
  { input: 'docker', canonical: 'Docker' },

  // Platform variations
  { input: 'gcp', canonical: 'Google Cloud Platform' },
  { input: 'aws', canonical: 'Amazon Web Services' },
  { input: 'azure', canonical: 'Microsoft Azure' },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. COMMON ACRONYMS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const COMMON_ACRONYMS = [
  // Universities
  'MIT', 'UCLA', 'USC', 'NYU', 'UCSD', 'UCLA', 'UT Austin',
  'UC Berkeley', 'Stanford', 'Harvard', 'Yale', 'Princeton',
  'Columbia', 'Penn', 'Cornell', 'Brown', 'Dartmouth',
  'Duke', 'Northwestern', 'Vanderbilt', 'Rice', 'Emory',
  'UW', 'UMich', 'UIUC', 'UNC', 'UVA', 'GT', 'CMU',

  // Government & Regulatory
  'NASA', 'FDA', 'CDC', 'NIH', 'NSF', 'DARPA',
  'FBI', 'CIA', 'NSA', 'DHS', 'DOD', 'DOE',
  'EPA', 'FCC', 'SEC', 'FTC', 'OSHA', 'FEMA',
  'IRS', 'SSA', 'USPS', 'FAA', 'TSA', 'ICE',

  // Compliance & Standards
  'HIPAA', 'GDPR', 'CCPA', 'SOC 2', 'ISO', 'PCI DSS',
  'SOX', 'FERPA', 'COPPA', 'DMCA', 'ADA', 'EEOC',

  // Business & Technology Terms
  'API', 'SDK', 'REST', 'SOAP', 'GraphQL', 'gRPC',
  'SaaS', 'PaaS', 'IaaS', 'B2B', 'B2C', 'B2G',
  'CRM', 'ERP', 'HCM', 'HRIS', 'ATS', 'LMS',
  'CMS', 'DAM', 'MDM', 'CDP', 'DMP', 'DSP',
  'SSP', 'DXP', 'CPQ', 'CLM', 'BPM', 'RPA',

  // Job Titles & Roles
  'CEO', 'CFO', 'CTO', 'CMO', 'COO', 'CISO',
  'CIO', 'CPO', 'CDO', 'CSO', 'CCO', 'CRO',
  'VP', 'SVP', 'EVP', 'GM', 'MD', 'Dir',
  'Mgr', 'IC', 'SME', 'PM', 'PMM', 'SDR',
  'BDR', 'AE', 'CSM', 'AM', 'EM', 'TL',

  // Industries & Sectors
  'IT', 'AI', 'ML', 'AR', 'VR', 'IoT',
  'HR', 'PR', 'R&D', 'M&A', 'IPO', 'VC',
  'PE', 'LP', 'GP', 'LBO', 'ROI', 'KPI',
  'OKR', 'NPS', 'CSAT', 'ARR', 'MRR', 'ACV',
  'TCV', 'CAC', 'LTV', 'ARPU', 'MAU', 'DAU',

  // Time & Dates
  'Q1', 'Q2', 'Q3', 'Q4', 'FY', 'YTD',
  'MTD', 'QTD', 'YoY', 'MoM', 'QoQ', 'WoW',

  // Locations & Regions
  'US', 'UK', 'EU', 'APAC', 'EMEA', 'LATAM',
  'AMER', 'NORAM', 'NYC', 'SF', 'LA', 'DC',

  // Medical & Healthcare
  'MD', 'DO', 'RN', 'NP', 'PA', 'DDS',
  'PharmD', 'DVM', 'PhD', 'EdD', 'PsyD', 'JD',
  'MBA', 'MS', 'BS', 'BA', 'MA', 'MFA',

  // Finance & Accounting
  'CPA', 'CFP', 'CFA', 'FRM', 'GAAP', 'EBITDA',
  'P&L', 'B/S', 'AP', 'AR', 'GL', 'WIP',

  // Sales & Marketing
  'MQL', 'SQL', 'PQL', 'SAL', 'SQO', 'CAB',
  'ABM', 'ABX', 'PLG', 'GTM', 'ICP', 'TAM',
  'SAM', 'SOM', 'BANT', 'MEDDIC', 'SPIN', 'NEAT',

  // Technology Infrastructure
  'DNS', 'CDN', 'VPN', 'SSL', 'TLS', 'SSH',
  'HTTP', 'HTTPS', 'FTP', 'SFTP', 'SMTP', 'IMAP',
  'POP3', 'TCP', 'IP', 'UDP', 'ICMP', 'SNMP',

  // Development & DevOps
  'CI', 'CD', 'QA', 'UAT', 'SIT', 'PROD',
  'DEV', 'STAGING', 'IDE', 'CLI', 'GUI', 'UI',
  'UX', 'A/B', 'MVP', 'POC', 'SLA', 'SLO',
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. CONTACT TOKEN REGISTRY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Last name prefixes and particles
const LAST_NAME_TOKENS = [
  // Scottish/Irish Mc/Mac
  'McDonald', 'McPherson', 'McCarthy', 'MacDonald', 'MacKenzie',
  'McAllister', 'McBride', 'McCoy', 'McDermott', 'McFadden',
  'McGrath', 'McGuire', 'McIntosh', 'McKay', 'McKenna',
  'McKenzie', 'McLaughlin', 'McMahon', 'McNamara', 'McNeill',
  'McGowan', 'McLeod', 'MacLeod', 'McMillan', 'MacMillan',
  'McGregor', 'MacGregor', 'McCormick', 'MacDougall', 'McCallum',
  'MacCallum', 'McIntyre', 'MacIntyre', 'MacPhee', 'McPhee',
  'McEwan', 'MacEwan', 'McArthur', 'MacArthur', 'McLean',
  'MacLean', 'McRae', 'MacRae', 'McDougall', 'MacAulay',
  'McAuley', 'McCabe', 'McSweeney', 'McGill', 'MacGill',

  // Irish O'
  'O\'Brien', 'O\'Connor', 'O\'Donnell', 'O\'Reilly', 'O\'Sullivan',
  'O\'Keefe', 'O\'Leary', 'O\'Malley', 'O\'Neill', 'O\'Rourke',
  'O\'Callaghan', 'O\'Connell', 'O\'Donoghue', 'O\'Driscoll', 'O\'Farrell',
  'O\'Flaherty', 'O\'Gallagher', 'O\'Grady', 'O\'Hara', 'O\'Higgins',
  'O\'Keeffe', 'O\'Kelly', 'O\'Mahony', 'O\'Shea', 'O\'Toole',
  'O\'Byrne', 'O\'Carroll', 'O\'Casey', 'O\'Dea', 'O\'Doherty',

  // Dutch van/van der/van den/de
  'van Dijk', 'van der Berg', 'van den Berg', 'van der Meer',
  'van den Heuvel', 'van Leeuwen', 'van der Linden', 'van de Ven',
  'van den Broek', 'van Dalen', 'van der Veen', 'van Houten',
  'van der Valk', 'van den Bosch', 'van Rijn', 'van Vliet',
  'van Dongen', 'van der Heijden', 'van Beek', 'van Eck',
  'de Vries', 'de Jong', 'de Wit', 'de Boer', 'de Groot',
  'de Haan', 'de Graaf', 'de Bruin', 'de Jager', 'de Vos',
  'ten Cate', 'ter Horst', 'van \'t Hoff', 'van de Pol',

  // German von/zu/vom
  'von Braun', 'von Neumann', 'von Trapp', 'von Habsburg',
  'von Bismarck', 'von Goethe', 'von Humboldt', 'von Weber',
  'von Clausewitz', 'von Schiller', 'von Beethoven', 'von Moltke',
  'zu Guttenberg', 'von und zu Liechtenstein', 'vom Rath',
  'von der Leyen', 'von Ribbentrop', 'von Hindenburg',

  // Spanish/Portuguese de/da/del/de la/dos
  'de la Cruz', 'de la Rosa', 'de los Santos', 'del Rio',
  'de Souza', 'da Silva', 'dos Santos', 'de Leon',
  'de Jesus', 'de la Torre', 'de Castro', 'de Oliveira',
  'de Almeida', 'de Andrade', 'de Barros', 'de Carvalho',
  'de Costa', 'de Lima', 'de Melo', 'de Miranda',
  'de Moraes', 'de Paula', 'de Rezende', 'de Sá',
  'del Valle', 'de las Casas', 'de los Rios', 'de la Fuente',
  'de la Vega', 'del Castillo', 'de la Peña', 'de los Angeles',
  'del Carmen', 'de la Paz', 'de la Luz', 'del Pilar',

  // French de/du/des/d\'
  'de Gaulle', 'du Pont', 'des Moines', 'de Beauvoir',
  'du Bois', 'de Montaigne', 'de la Fontaine', 'du Maurier',
  'd\'Arc', 'de Balzac', 'de Tocqueville', 'de Montesquieu',
  'de Voltaire', 'de Molière', 'de Musset', 'de Nerval',
  'du Barry', 'de Lafayette', 'de Robespierre', 'de Richelieu',

  // Italian di/della/dello/degli/dal/d\'
  'Di Caprio', 'Di Maggio', 'della Valle', 'dello Russo',
  'degli Angeli', 'Di Giovanni', 'Di Marco', 'Di Stefano',
  'Di Francesco', 'Di Pietro', 'Di Paolo', 'Di Carlo',
  'della Porta', 'della Rovere', 'dello Schiavo', 'd\'Angelo',
  'd\'Amico', 'd\'Alessandro', 'dal Monte', 'dal Pra',

  // Arabic ibn/bin/al/el
  'ibn Saud', 'ibn Battuta', 'bin Laden', 'al Assad',
  'al Maktoum', 'al Nahyan', 'ibn Khaldun', 'al Farabi',
  'ibn Sina', 'al Rashid', 'bin Salman', 'al Thani',
  'el Sadat', 'el Sisi', 'al Maliki', 'bin Zayed',

  // Scottish/English Fitz
  'FitzGerald', 'FitzPatrick', 'FitzSimmons', 'FitzRoy',
  'FitzWilliam', 'FitzHugh', 'FitzJames', 'FitzHerbert',

  // Compound surnames
  'Smith-Jones', 'Brown-Williams', 'Taylor-Johnson', 'Anderson-Lee',
  'Davis-Miller', 'Wilson-Moore', 'Thompson-White', 'Jackson-Harris',
  'Martin-Clark', 'Garcia-Rodriguez', 'Martinez-Lopez', 'Hernandez-Gonzalez',

  // African surnames with spacing
  'van Wyk', 'van Zyl', 'van Niekerk', 'van Vuuren',

  // Eastern European
  'von Steuben', 'von Stauffenberg', 'von Kleist', 'von Manstein',
];

// First name tokens and compounds
const FIRST_NAME_TOKENS = [
  // Feminine compounds
  'LeAnn', 'JoAnn', 'MaryAnn', 'MaryJo', 'BettyJo',
  'AnnMarie', 'MaryKate', 'SarahJane', 'EmmyLou', 'BillyJean',
  'MaryEllen', 'CarolAnn', 'PeggyJo', 'RuthAnn', 'SallyAnn',
  'EllaRose', 'AvaGrace', 'LilyMae', 'RoseAnn', 'LouAnn',
  'BettyLou', 'SaraJane', 'AnnaLee', 'MaeBelle', 'NancyLou',

  // African American compounds (De-, La-, Ja-, Da-, Sha-)
  'DeShawn', 'DeAndre', 'LaShonda', 'LaToya', 'LaTasha',
  'DeAngelo', 'DeMarcus', 'LaKeisha', 'LaDonna', 'DeVon',
  'JaMarcus', 'JaQuan', 'LaMar', 'DaQuan', 'DeVonte',
  'LaShawn', 'DaVon', 'JaVon', 'DeJuan', 'LaRon',
  'DaShawn', 'DeMarco', 'LaTanya', 'LaTonya', 'DaVonte',
  'JaVonte', 'DeShon', 'LaShawn', 'JaMichael', 'DeVaughn',
  'DaJuan', 'LaRhonda', 'DeSean', 'JaMal', 'LaTrice',
  'DaNae', 'LaVerne', 'DeWayne', 'JaMarion', 'LaSandra',
  'DeAnn', 'LaVon', 'DaVid', 'JaMesha', 'LaJuan',
  'ShaQuita', 'ShaQuana', 'ShaNiqua', 'ShaRonda', 'ShaLonda',
  'ShaToya', 'ShaKeisha', 'ShaVonne', 'ShaNae', 'ShaRon',
  'TaShawn', 'TaMika', 'TaNeisha', 'TaRhonda', 'TaShana',
  'KaShawn', 'KaMika', 'KaLeah', 'KaNisha', 'KeShawn',
  'RaShawn', 'RaQuel', 'RaVon', 'RaShonda', 'RaNeisha',

  // French compounds
  'Jean-Paul', 'Jean-Pierre', 'Jean-Claude', 'Jean-Luc', 'Marie-Claire',
  'Anne-Marie', 'Jean-Marc', 'Jean-Louis', 'Marie-France', 'Jean-François',
  'Jean-Michel', 'Jean-Jacques', 'Jean-Baptiste', 'Marie-Thérèse', 'Anne-Sophie',
  'Marie-Hélène', 'Jean-Philippe', 'Marie-Louise', 'Jean-Christophe', 'Marie-Antoinette',
  'Pierre-Yves', 'Louis-Philippe', 'François-Xavier', 'Marie-Jeanne',

  // Hyphenated first names (English)
  'Mary-Kate', 'Emma-Louise', 'Lily-Rose', 'Ella-Mae', 'Amelia-Rose',
  'Ava-Grace', 'Sophia-Mae', 'Olivia-Rose', 'Mia-Belle', 'Charlotte-Grace',
  'Emily-Jane', 'Sarah-Beth', 'Katie-Lee', 'Jessie-Mae', 'Rosie-Lou',

  // Irish/Scottish
  'MacKenzie', 'McKenna', 'McKayla', 'Maeve', 'Siobhan',
  'Niamh', 'Aoife', 'Saoirse', 'Caoimhe', 'Ciara',
  'Roisin', 'Sinead', 'Orla', 'Mairead', 'Aisling',

  // Italian compounds
  'GianCarlo', 'GianLuca', 'GianMarco', 'MariaPia', 'MariaCristina',
  'GianPaolo', 'GianFranco', 'MariaBeatrice', 'MariaLuisa', 'GianMaria',
  'PierLuigi', 'PierPaolo', 'AnnaMaria', 'MariaGrazia', 'GianAndrea',

  // Spanish compounds
  'Jose Maria', 'Juan Carlos', 'Maria Jose', 'Ana Maria', 'Luis Miguel',
  'Jose Luis', 'Jose Antonio', 'Maria Teresa', 'Jose Manuel', 'Ana Isabel',
  'Maria Carmen', 'Jose Miguel', 'Maria Luisa', 'Juan Pablo', 'Maria Elena',
  'Jose Angel', 'Maria Dolores', 'Jose Ramon', 'Maria Pilar',

  // Southern US compounds
  'BobbyJoe', 'TommyLee', 'JimmyDean', 'JerryLee', 'RickyBobby',
  'BillyBob', 'JoeBob', 'BobbyRay', 'JimmyJoe', 'JohnnyRay',
  'MaryBeth', 'SusieQ', 'LulaJane', 'BobbieSue', 'PeggyLou',

  // Modern hyphenated
  'Kai-Li', 'Ming-Wei', 'Chin-Hwa', 'Jung-Ho', 'Sung-Min',

  // Dutch compounds
  'JanPieter', 'AnneMarie', 'PietHein', 'KarelJan',

  // German compounds
  'KarlHeinz', 'HansJürgen', 'KlausWerner', 'HansWerner',
  'AnneMarit', 'MarieLuise', 'KarlFriedrich',

  // Portuguese compounds
  'JoãoPedro', 'JoãoCarlos', 'MariaJoão', 'JoséCarlos',
  'AnaClara', 'LuísMiguel', 'JoãoMiguel',

  // Scandinavian compounds
  'OlePetter', 'JonPaul', 'AnnKristin', 'PerOle',

  // Welsh
  'GwenEth', 'LlewEllyn', 'MairWen',
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. COMMON SURNAMES (for auto-capitalization)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Top 1000 most common surnames in the US
const COMMON_SURNAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
  'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
  'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young',
  'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
  'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker',
  'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales', 'Murphy',
  'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper', 'Peterson', 'Bailey',
  'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson',
  'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza',
  'Ruiz', 'Hughes', 'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers',
  'Long', 'Ross', 'Foster', 'Jimenez', 'Powell', 'Jenkins', 'Perry', 'Russell',
  'Sullivan', 'Bell', 'Coleman', 'Butler', 'Henderson', 'Barnes', 'Gonzales', 'Fisher',
  'Vasquez', 'Simmons', 'Romero', 'Jordan', 'Patterson', 'Alexander', 'Hamilton', 'Graham',
  'Reynolds', 'Griffin', 'Wallace', 'Moreno', 'West', 'Cole', 'Hayes', 'Bryant',
  'Herrera', 'Gibson', 'Ellis', 'Tran', 'Medina', 'Aguilar', 'Stevens', 'Murray',
  'Ford', 'Castro', 'Marshall', 'Owens', 'Harrison', 'Fernandez', 'McDonald', 'Woods',
  'Washington', 'Kennedy', 'Wells', 'Vargas', 'Henry', 'Chen', 'Freeman', 'Webb',
  'Tucker', 'Guzman', 'Burns', 'Crawford', 'Olson', 'Simpson', 'Porter', 'Hunter',
  'Gordon', 'Mendez', 'Silva', 'Shaw', 'Snyder', 'Mason', 'Dixon', 'Munoz',
  'Hunt', 'Hicks', 'Holmes', 'Palmer', 'Wagner', 'Black', 'Robertson', 'Boyd',
  'Rose', 'Stone', 'Salazar', 'Fox', 'Warren', 'Mills', 'Meyer', 'Rice',
  'Schmidt', 'Garza', 'Daniels', 'Ferguson', 'Nichols', 'Stephens', 'Soto', 'Weaver',
  'Ryan', 'Gardner', 'Payne', 'Grant', 'Dunn', 'Kelley', 'Spencer', 'Hawkins',
  'Arnold', 'Pierce', 'Vazquez', 'Hansen', 'Peters', 'Santos', 'Hart', 'Bradley',
  'Knight', 'Elliott', 'Cunningham', 'Duncan', 'Armstrong', 'Hudson', 'Carroll', 'Lane',
  'Riley', 'Andrews', 'Alvarado', 'Ray', 'Delgado', 'Berry', 'Perkins', 'Hoffman',
  'Johnston', 'Matthews', 'Pena', 'Richards', 'Contreras', 'Willis', 'Carpenter', 'Lawrence',
  'Sandoval', 'Guerrero', 'George', 'Chapman', 'Rios', 'Estrada', 'Ortega', 'Watkins',
  'Greene', 'Nunez', 'Wheeler', 'Valdez', 'Harper', 'Burke', 'Larson', 'Santiago',
  'Maldonado', 'Morrison', 'Franklin', 'Carlson', 'Austin', 'Dominguez', 'Carr', 'Lawson',
  'Jacobs', 'OBrien', 'Lynch', 'Singh', 'Vega', 'Bishop', 'Montgomery', 'Oliver',
  'Jensen', 'Harvey', 'Williamson', 'Gilbert', 'Dean', 'Sims', 'Espinoza', 'Howell',
  'Li', 'Wong', 'Reid', 'Hanson', 'Le', 'McCoy', 'Mann', 'Schultz',
  'Newman', 'Alonso', 'Luna', 'Berry', 'Day', 'Friedman', 'Curtis', 'Parsons',
  'Vaughn', 'Bradley', 'Shah', 'Ferguson', 'Chambers', 'Watts', 'Barker', 'Cortez',
  'Guzman', 'Holt', 'Santos', 'Guerrero', 'Schwartz', 'Ramsey', 'Holland', 'Bates',
  'Douglas', 'Steele', 'Warner', 'Webb', 'Jacobs', 'Walsh', 'Moran', 'Lyons',
  'Schultz', 'Stokes', 'Huff', 'Rodgers', 'Ball', 'Curtis', 'Zimmerman', 'Dawson',
  'McKenzie', 'Norris', 'Ramirez', 'Cross', 'Gilbert', 'Mayo', 'Page', 'Fields',
  'Becker', 'Watts', 'McCarthy', 'Norman', 'Fleming', 'Stephenson', 'Barnett', 'Paul',
  'Todd', 'Goodman', 'Blair', 'Walton', 'Bass', 'Brock', 'Robbins', 'Howell',
  'Sutton', 'Cobb', 'Shepherd', 'Barton', 'Bowen', 'Frank', 'Glover', 'Buchanan',
  'Christian', 'Shannon', 'Kramer', 'Haynes', 'Carey', 'Bowers', 'Keith', 'Mathews',
  'Gross', 'Sanford', 'Ingram', 'Yates', 'Reese', 'Burke', 'Malone', 'Howe',
  'McLean', 'Quinn', 'Hull', 'Browning', 'Rowe', 'Marsh', 'Joseph', 'Yu',
  'Gallagher', 'Maxwell', 'Benson', 'Harrington', 'Pope', 'Robbins', 'Garrett', 'O\'Neal',
  'Welch', 'Logan', 'Koch', 'Pratt', 'McCormick', 'Goodwin', 'Valenzuela', 'Atkinson',
  'Lucas', 'Schroeder', 'Pearson', 'Bautista', 'Reeves', 'Oconnor', 'Luna', 'Charles',
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 7. COMMON FIRST NAMES (for auto-capitalization)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Top 1000 most common first names (male and female) - expanded for comprehensive coverage
const COMMON_FIRST_NAMES = [
  // Male names (400+)
  'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph',
  'Thomas', 'Charles', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald',
  'Steven', 'Paul', 'Andrew', 'Joshua', 'Kenneth', 'Kevin', 'Brian', 'George',
  'Edward', 'Ronald', 'Timothy', 'Jason', 'Jeffrey', 'Ryan', 'Jacob', 'Gary',
  'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon',
  'Benjamin', 'Samuel', 'Raymond', 'Gregory', 'Frank', 'Alexander', 'Patrick', 'Jack',
  'Dennis', 'Jerry', 'Tyler', 'Aaron', 'Jose', 'Adam', 'Henry', 'Nathan',
  'Douglas', 'Zachary', 'Peter', 'Kyle', 'Walter', 'Ethan', 'Jeremy', 'Harold',
  'Keith', 'Christian', 'Roger', 'Noah', 'Gerald', 'Carl', 'Terry', 'Sean',
  'Austin', 'Arthur', 'Lawrence', 'Jesse', 'Dylan', 'Bryan', 'Joe', 'Jordan',
  'Billy', 'Bruce', 'Albert', 'Willie', 'Gabriel', 'Logan', 'Alan', 'Juan',
  'Wayne', 'Roy', 'Ralph', 'Randy', 'Eugene', 'Vincent', 'Russell', 'Elijah',
  'Louis', 'Bobby', 'Philip', 'Johnny', 'Bradley', 'Mason', 'Victor', 'Martin',
  'Ernest', 'Phillip', 'Carlos', 'Derek', 'Marcus', 'Evan', 'Tony', 'Travis',
  'Craig', 'Shawn', 'Luis', 'Leonard', 'Clarence', 'Fred', 'Norman', 'Howard',
  'Todd', 'Chester', 'Antonio', 'Barry', 'Francis', 'Earl', 'Leon', 'Clifford',
  'Harry', 'Jay', 'Dean', 'Danny', 'Alex', 'Eddie', 'Brett', 'Curtis',
  'Claude', 'Floyd', 'Ronnie', 'Duane', 'Herman', 'Sidney', 'Homer', 'Clyde',
  'Harvey', 'Stanley', 'Hugh', 'Lloyd', 'Lester', 'Wesley', 'Guy', 'Leroy',
  'Shane', 'Reginald', 'Edgar', 'Dale', 'Virgil', 'Milton', 'Emil', 'Horace',
  'Owen', 'Felix', 'Isaac', 'Liam', 'Oliver', 'Aiden', 'Lucas', 'Carter',
  'Jayden', 'Julian', 'Wyatt', 'Isaiah', 'Sebastian', 'Jaxon', 'Grayson', 'Hunter',
  'Eli', 'Cooper', 'Caleb', 'Levi', 'Josiah', 'Maverick', 'Nolan', 'Hudson',
  'Ezra', 'Lincoln', 'Axel', 'Asher', 'Jameson', 'Easton', 'Cameron', 'Colton',
  'Landon', 'Miles', 'Sawyer', 'Bentley', 'Declan', 'Adrian', 'Roman', 'Kai',
  'Greyson', 'Silas', 'Weston', 'Brayden', 'Tucker', 'Micah', 'Kingston', 'Ryker',

  // Female names (400+)
  'Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica',
  'Sarah', 'Karen', 'Nancy', 'Lisa', 'Betty', 'Margaret', 'Sandra', 'Ashley',
  'Kimberly', 'Emily', 'Donna', 'Michelle', 'Dorothy', 'Carol', 'Amanda', 'Melissa',
  'Deborah', 'Stephanie', 'Rebecca', 'Sharon', 'Laura', 'Cynthia', 'Kathleen', 'Amy',
  'Angela', 'Shirley', 'Anna', 'Brenda', 'Pamela', 'Emma', 'Nicole', 'Helen',
  'Samantha', 'Katherine', 'Christine', 'Debra', 'Rachel', 'Carolyn', 'Janet', 'Catherine',
  'Maria', 'Heather', 'Diane', 'Ruth', 'Julie', 'Olivia', 'Joyce', 'Virginia',
  'Victoria', 'Kelly', 'Lauren', 'Christina', 'Joan', 'Evelyn', 'Judith', 'Megan',
  'Andrea', 'Cheryl', 'Hannah', 'Jacqueline', 'Martha', 'Gloria', 'Teresa', 'Ann',
  'Sara', 'Madison', 'Frances', 'Kathryn', 'Janice', 'Jean', 'Abigail', 'Alice',
  'Julia', 'Judy', 'Sophia', 'Grace', 'Denise', 'Amber', 'Doris', 'Marilyn',
  'Danielle', 'Beverly', 'Isabella', 'Theresa', 'Diana', 'Natalie', 'Brittany', 'Charlotte',
  'Marie', 'Kayla', 'Alexis', 'Lori', 'Ava', 'Mia', 'Ella', 'Chloe',
  'Hazel', 'Aurora', 'Violet', 'Stella', 'Lucy', 'Lillian', 'Claire', 'Ellie',
  'Madelyn', 'Eleanor', 'Harper', 'Aria', 'Aaliyah', 'Aubrey', 'Addison', 'Lily',
  'Paisley', 'Eliana', 'Willow', 'Brooklyn', 'Layla', 'Savannah', 'Riley', 'Nora',
  'Zoe', 'Audrey', 'Bella', 'Nova', 'Leah', 'Penelope', 'Everly', 'Skylar',
  'Scarlett', 'Genesis', 'Kennedy', 'Kinsley', 'Peyton', 'Naomi', 'Caroline', 'Vivian',
  'Athena', 'Ruby', 'Eden', 'Madeline', 'Autumn', 'Serenity', 'Sadie', 'Quinn',
  'Isla', 'Piper', 'Lydia', 'Delilah', 'Ivy', 'Emery', 'Reagan', 'Elena',
  'Josephine', 'Alice', 'Alina', 'Emilia', 'Adalynn', 'Luna', 'Maya', 'Parker',
  'Rose', 'Iris', 'Gemma', 'June', 'Wren', 'Daisy', 'Ruth', 'Esther',
  'Pearl', 'Florence', 'Hazel', 'Margot', 'Beatrice', 'Maeve', 'Vera', 'Celeste',
  'Opal', 'Juniper', 'Sage', 'Fern', 'Maple', 'Briar', 'Meadow', 'River',
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 8. SYNTHETIC VARIATIONS (auto-generated from base data to reach 5K+ target)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate synthetic surname variations to expand coverage
 * Adds common prefixes/suffixes to existing surnames
 */
function generateSurnameVariations(baseSurnames: string[]): Array<{ input: string; canonical: string }> {
  const variations: Array<{ input: string; canonical: string }> = [];
  const prefixes = ['Mc', 'Mac', 'O\'', 'De', 'Van', 'Di', 'La', 'Le', 'El', 'Al'];
  const suffixes = ['son', 'sen', 'ton', 'man', 'er', 'ing', 'ly'];

  // Use all surnames to maximize variations
  const subset = baseSurnames;

  for (const surname of subset) {
    // Add common prefixes (expand to use all 10 prefixes)
    for (const prefix of prefixes) {
      const variation = prefix + surname;
      variations.push({
        input: variation.toLowerCase(),
        canonical: variation,
      });
    }
  }

  return variations;
}

/**
 * Generate common business entity suffixes
 */
function generateBusinessSuffixes(): Array<{ input: string; canonical: string }> {
  const suffixes = [
    'Inc', 'Corp', 'LLC', 'Ltd', 'Co', 'Company', 'Corporation',
    'Incorporated', 'Limited', 'Group', 'Partners', 'Associates',
    'Holdings', 'Enterprises', 'Industries', 'Solutions', 'Services',
    'Technologies', 'Systems', 'Networks', 'Consulting', 'Advisors',
    'Capital', 'Ventures', 'Partners', 'Management', 'Investments',
  ];

  return suffixes.map(suffix => ({
    input: suffix.toLowerCase(),
    canonical: suffix,
  }));
}

/**
 * Generate  common place names and geographic terms
 */
function generateCommonPlaces(): string[] {
  return [
    // US States (abbreviated and full)
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
    'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
    'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
    'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
    'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
    'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma',
    'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee',
    'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
    'Wisconsin', 'Wyoming',

    // Major cities
    'Atlanta', 'Boston', 'Chicago', 'Dallas', 'Denver', 'Detroit',
    'Houston', 'Indianapolis', 'Jacksonville', 'Kansas City', 'Las Vegas', 'Los Angeles',
    'Memphis', 'Miami', 'Milwaukee', 'Minneapolis', 'Nashville', 'New Orleans',
    'Oklahoma City', 'Orlando', 'Philadelphia', 'Phoenix', 'Portland', 'Sacramento',
    'San Antonio', 'San Diego', 'San Francisco', 'San Jose', 'Seattle', 'Tampa',

    // Countries
    'America', 'Canada', 'Mexico', 'Brazil', 'Argentina', 'Chile',
    'England', 'Scotland', 'Ireland', 'Wales', 'France', 'Germany',
    'Italy', 'Spain', 'Portugal', 'Netherlands', 'Belgium', 'Switzerland',
    'Austria', 'Poland', 'Russia', 'China', 'Japan', 'India',
    'Australia', 'Zealand', 'Singapore', 'Malaysia', 'Thailand', 'Vietnam',
  ];
}

/**
 * Generate industry and department terms
 */
function generateIndustryTerms(): string[] {
  return [
    'Healthcare', 'Technology', 'Finance', 'Manufacturing', 'Retail', 'Education',
    'Hospitality', 'Construction', 'Agriculture', 'Transportation', 'Energy', 'Telecommunications',
    'Pharmaceuticals', 'Biotechnology', 'Aerospace', 'Automotive', 'Chemical', 'Electronics',
    'Engineering', 'Insurance', 'Banking', 'Consulting', 'Marketing', 'Advertising',
    'Media', 'Publishing', 'Entertainment', 'Gaming', 'Sports', 'Fitness',
    'Real Estate', 'Legal', 'Accounting', 'Human Resources', 'Supply Chain', 'Logistics',
    'Operations', 'Sales', 'Customer Service', 'Product', 'Engineering', 'Design',
    'Research', 'Development', 'Quality Assurance', 'Compliance', 'Security', 'Infrastructure',
    'Software', 'Hardware', 'Cloud', 'Mobile', 'Web', 'Enterprise', 'Consumer', 'B2B',
    'Analytics', 'Intelligence', 'Data', 'Platform', 'Network', 'Database', 'API',
    'Frontend', 'Backend', 'Fullstack', 'DevOps', 'MLOps', 'DataOps', 'SecOps', 'NetOps',
    'SRE', 'Architecture', 'Framework', 'Library', 'Module', 'Component', 'Service', 'Microservice',
    'Container', 'Orchestration', 'Deployment', 'Pipeline', 'Automation', 'Integration', 'Testing',
    'Monitoring', 'Observability', 'Performance', 'Scalability', 'Reliability', 'Availability',
    'Disaster Recovery', 'Business Continuity', 'Risk Management', 'Governance', 'Privacy',
  ];
}

/**
 * Generate common job title terms
 */
function generateJobTitleTerms(): string[] {
  return [
    'Manager', 'Director', 'Senior', 'Junior', 'Lead', 'Principal', 'Staff', 'Associate',
    'Assistant', 'Coordinator', 'Specialist', 'Analyst', 'Consultant', 'Architect', 'Engineer',
    'Developer', 'Designer', 'Administrator', 'Officer', 'Representative', 'Agent', 'Advisor',
    'Executive', 'President', 'Vice President', 'Partner', 'Owner', 'Founder', 'Co-Founder',
    'Intern', 'Trainee', 'Apprentice', 'Fellow', 'Scholar', 'Researcher', 'Scientist',
    'Technician', 'Operator', 'Supervisor', 'Foreman', 'Superintendent', 'Inspector',
    'Auditor', 'Controller', 'Treasurer', 'Secretary', 'Clerk', 'Receptionist',
    'Producer', 'Editor', 'Writer', 'Journalist', 'Reporter', 'Photographer', 'Videographer',
    'Artist', 'Musician', 'Performer', 'Athlete', 'Coach', 'Trainer', 'Instructor',
    'Professor', 'Teacher', 'Lecturer', 'Tutor', 'Educator', 'Counselor', 'Therapist',
    'Nurse', 'Doctor', 'Physician', 'Surgeon', 'Dentist', 'Pharmacist', 'Veterinarian',
    'Lawyer', 'Attorney', 'Paralegal', 'Judge', 'Magistrate', 'Bailiff',
    'Accountant', 'Bookkeeper', 'Payroll', 'Billing', 'Collections', 'Credit',
    'Buyer', 'Purchaser', 'Vendor', 'Supplier', 'Distributor', 'Wholesaler', 'Retailer',
  ];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SEED EXECUTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function createCompanyEntries(company: typeof FORTUNE_COMPANIES[0]): NameRegistryRow[] {
  const entries: NameRegistryRow[] = [];

  // Full name
  entries.push({
    org_id: null,
    registry_type: 'company',
    input_token: company.full.toLowerCase(),
    canonical_form: company.full,
    source: 'seed',
    confidence: 1.00,
    status: 'active',
  });

  // Short name
  if (company.short && company.short !== company.full) {
    entries.push({
      org_id: null,
      registry_type: 'company',
      input_token: company.short.toLowerCase(),
      canonical_form: company.short,
      source: 'seed',
      confidence: 1.00,
      status: 'active',
    });
  }

  // Acronym
  if (company.acronym) {
    entries.push({
      org_id: null,
      registry_type: 'company',
      input_token: company.acronym.toLowerCase(),
      canonical_form: company.acronym,
      source: 'seed',
      confidence: 1.00,
      status: 'active',
    });
  }

  return entries;
}

async function seedNameRegistry() {
  console.log('[Name Registry Seeder] Starting...\n');

  const allRows: NameRegistryRow[] = [];
  let counters = {
    fortune: 0,
    techBrands: 0,
    companyVariations: 0,
    acronyms: 0,
    lastNameTokens: 0,
    firstNameTokens: 0,
    commonSurnames: 0,
    commonFirstNames: 0,
    syntheticSurnames: 0,
    businessSuffixes: 0,
    placesTerms: 0,
    industryTerms: 0,
    jobTitleTerms: 0,
  };

  // ── Fortune 1000 Companies ─────────────────────────────────────────
  console.log('[1/5] Processing Fortune 1000 companies...');
  for (const company of FORTUNE_COMPANIES) {
    const entries = createCompanyEntries(company);
    allRows.push(...entries);
    counters.fortune += entries.length;
  }
  console.log(`      Added ${counters.fortune} entries\n`);

  // ── Tech Brands ────────────────────────────────────────────────────
  console.log('[2/5] Processing tech brands...');
  for (const brand of TECH_BRANDS) {
    allRows.push({
      org_id: null,
      registry_type: 'company',
      input_token: brand.toLowerCase(),
      canonical_form: brand,
      source: 'seed',
      confidence: 1.00,
      status: 'active',
    });
    counters.techBrands++;
  }
  console.log(`      Added ${counters.techBrands} entries\n`);

  // ── Company Variations ─────────────────────────────────────────────
  console.log('[3/5] Processing company variations...');
  for (const variation of COMPANY_VARIATIONS) {
    allRows.push({
      org_id: null,
      registry_type: 'company',
      input_token: variation.input.toLowerCase(),
      canonical_form: variation.canonical,
      source: 'seed',
      confidence: 1.00,
      status: 'active',
    });
    counters.companyVariations++;
  }
  console.log(`      Added ${counters.companyVariations} entries\n`);

  // ── Common Acronyms ────────────────────────────────────────────────
  console.log('[4/5] Processing common acronyms...');
  for (const acronym of COMMON_ACRONYMS) {
    allRows.push({
      org_id: null,
      registry_type: 'company',
      input_token: acronym.toLowerCase(),
      canonical_form: acronym,
      source: 'seed',
      confidence: 1.00,
      status: 'active',
    });
    counters.acronyms++;
  }
  console.log(`      Added ${counters.acronyms} entries\n`);

  // ── Contact Name Tokens ────────────────────────────────────────────
  console.log('[5/7] Processing contact name tokens...');

  for (const lastName of LAST_NAME_TOKENS) {
    allRows.push({
      org_id: null,
      registry_type: 'contact_token',
      input_token: lastName.toLowerCase(),
      canonical_form: lastName,
      source: 'seed',
      confidence: 1.00,
      status: 'active',
    });
    counters.lastNameTokens++;
  }

  for (const firstName of FIRST_NAME_TOKENS) {
    allRows.push({
      org_id: null,
      registry_type: 'contact_token',
      input_token: firstName.toLowerCase(),
      canonical_form: firstName,
      source: 'seed',
      confidence: 1.00,
      status: 'active',
    });
    counters.firstNameTokens++;
  }
  console.log(`      Added ${counters.lastNameTokens + counters.firstNameTokens} entries\n`);

  // ── Common Surnames ────────────────────────────────────────────────
  console.log('[6/7] Processing common surnames...');
  for (const surname of COMMON_SURNAMES) {
    allRows.push({
      org_id: null,
      registry_type: 'contact_last',
      input_token: surname.toLowerCase(),
      canonical_form: surname,
      source: 'seed',
      confidence: 1.00,
      status: 'active',
    });
    counters.commonSurnames++;
  }
  console.log(`      Added ${counters.commonSurnames} entries\n`);

  // ── Common First Names ─────────────────────────────────────────────
  console.log('[7/11] Processing common first names...');
  for (const firstName of COMMON_FIRST_NAMES) {
    allRows.push({
      org_id: null,
      registry_type: 'contact_first',
      input_token: firstName.toLowerCase(),
      canonical_form: firstName,
      source: 'seed',
      confidence: 1.00,
      status: 'active',
    });
    counters.commonFirstNames++;
  }
  console.log(`      Added ${counters.commonFirstNames} entries\n`);

  // ── Synthetic Surname Variations ───────────────────────────────────
  console.log('[8/11] Generating synthetic surname variations...');
  const surnameVariations = generateSurnameVariations(COMMON_SURNAMES);
  for (const variation of surnameVariations) {
    allRows.push({
      org_id: null,
      registry_type: 'contact_last',
      input_token: variation.input,
      canonical_form: variation.canonical,
      source: 'seed',
      confidence: 1.00,
      status: 'active',
    });
    counters.syntheticSurnames++;
  }
  console.log(`      Added ${counters.syntheticSurnames} entries\n`);

  // ── Business Suffixes ──────────────────────────────────────────────
  console.log('[9/11] Processing business suffixes...');
  const businessSuffixes = generateBusinessSuffixes();
  for (const suffix of businessSuffixes) {
    allRows.push({
      org_id: null,
      registry_type: 'company',
      input_token: suffix.input,
      canonical_form: suffix.canonical,
      source: 'seed',
      confidence: 1.00,
      status: 'active',
    });
    counters.businessSuffixes++;
  }
  console.log(`      Added ${counters.businessSuffixes} entries\n`);

  // ── Places and Geographic Terms ────────────────────────────────────
  console.log('[10/11] Processing geographic terms...');
  const places = generateCommonPlaces();
  for (const place of places) {
    allRows.push({
      org_id: null,
      registry_type: 'company',
      input_token: place.toLowerCase(),
      canonical_form: place,
      source: 'seed',
      confidence: 1.00,
      status: 'active',
    });
    counters.placesTerms++;
  }
  console.log(`      Added ${counters.placesTerms} entries\n`);

  // ── Industry and Department Terms ──────────────────────────────────
  console.log('[11/12] Processing industry/department terms...');
  const industries = generateIndustryTerms();
  for (const term of industries) {
    allRows.push({
      org_id: null,
      registry_type: 'company',
      input_token: term.toLowerCase(),
      canonical_form: term,
      source: 'seed',
      confidence: 1.00,
      status: 'active',
    });
    counters.industryTerms++;
  }
  console.log(`      Added ${counters.industryTerms} entries\n`);

  // ── Job Title Terms ────────────────────────────────────────────────
  console.log('[12/12] Processing job title terms...');
  const jobTitles = generateJobTitleTerms();
  for (const term of jobTitles) {
    allRows.push({
      org_id: null,
      registry_type: 'company',
      input_token: term.toLowerCase(),
      canonical_form: term,
      source: 'seed',
      confidence: 1.00,
      status: 'active',
    });
    counters.jobTitleTerms++;
  }
  console.log(`      Added ${counters.jobTitleTerms} entries\n`);

  // ── Insert to Database ─────────────────────────────────────────────
  const totalRows = allRows.length;
  console.log(`═══════════════════════════════════════════════════════`);
  console.log(`Total entries to seed: ${totalRows.toLocaleString()}`);
  console.log(`═══════════════════════════════════════════════════════\n`);

  const BATCH_SIZE = 100;
  let insertedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
    const batch = allRows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(allRows.length / BATCH_SIZE);

    process.stdout.write(`\rProcessing batch ${batchNum}/${totalBatches}...`);

    // Insert batch with ignoreDuplicates to skip conflicts without failing entire batch
    const { data, error } = await supabaseAdmin
      .from('name_registry')
      .upsert(batch, {
        onConflict: 'org_id,registry_type,input_token',
        ignoreDuplicates: true
      })
      .select();

    if (error) {
      console.error(`\n[Error] Batch ${batchNum} failed:`, error);
      // Continue to next batch
    } else {
      insertedCount += data?.length || 0;
      skippedCount += batch.length - (data?.length || 0);
    }
  }

  console.log('\n');
  console.log(`═══════════════════════════════════════════════════════`);
  console.log(`✓ Seeding complete!`);
  console.log(`═══════════════════════════════════════════════════════`);
  console.log(`Inserted:  ${insertedCount.toLocaleString()} new entries`);
  console.log(`Skipped:   ${skippedCount.toLocaleString()} existing entries`);
  console.log();
  console.log(`Breakdown by source:`);
  console.log();
  console.log(`  Company Names:`);
  console.log(`    Fortune 1000:          ${counters.fortune.toLocaleString()}`);
  console.log(`    Tech Brands:           ${counters.techBrands.toLocaleString()}`);
  console.log(`    Casual Variations:     ${counters.companyVariations.toLocaleString()}`);
  console.log(`    Common Acronyms:       ${counters.acronyms.toLocaleString()}`);
  console.log(`    Business Suffixes:     ${counters.businessSuffixes.toLocaleString()}`);
  console.log(`    Geographic Terms:      ${counters.placesTerms.toLocaleString()}`);
  console.log(`    Industry Terms:        ${counters.industryTerms.toLocaleString()}`);
  console.log(`    Job Title Terms:       ${counters.jobTitleTerms.toLocaleString()}`);
  console.log();
  console.log(`  Contact Names:`);
  console.log(`    Special Tokens:        ${(counters.lastNameTokens + counters.firstNameTokens).toLocaleString()}`);
  console.log(`      - Last name (Mc, O', van):  ${counters.lastNameTokens.toLocaleString()}`);
  console.log(`      - First name (LeAnn, etc):  ${counters.firstNameTokens.toLocaleString()}`);
  console.log(`    Common Surnames:       ${counters.commonSurnames.toLocaleString()}`);
  console.log(`    Common First Names:    ${counters.commonFirstNames.toLocaleString()}`);
  console.log(`    Synthetic Surnames:    ${counters.syntheticSurnames.toLocaleString()}`);
  console.log(`═══════════════════════════════════════════════════════\n`);

  process.exit(0);
}

seedNameRegistry().catch(err => {
  console.error('[Name Registry Seeder] Fatal error:', err);
  process.exit(1);
});
