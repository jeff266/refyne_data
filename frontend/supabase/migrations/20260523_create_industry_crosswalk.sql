-- Industry Crosswalk Table
-- Maps NAICS codes to provider-specific labels and CRM enum values

create table if not exists industry_crosswalk (
  naics_code text primary key,
  naics_label text not null,
  apollo_label text,
  hubspot_value text,
  linkedin_value text,
  sic_code text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Index for reverse lookups
create index if not exists idx_industry_crosswalk_apollo on industry_crosswalk(apollo_label);
create index if not exists idx_industry_crosswalk_hubspot on industry_crosswalk(hubspot_value);

-- Add comments
comment on table industry_crosswalk is 'NAICS crosswalk for mapping provider industry labels to CRM enum values';
comment on column industry_crosswalk.naics_code is '6-digit NAICS code (e.g., 541512)';
comment on column industry_crosswalk.naics_label is 'Official NAICS industry description';
comment on column industry_crosswalk.apollo_label is 'Apollo.io industry label';
comment on column industry_crosswalk.hubspot_value is 'HubSpot industry enum value';
comment on column industry_crosswalk.linkedin_value is 'LinkedIn industry label';
comment on column industry_crosswalk.sic_code is '4-digit SIC code for legacy systems';

-- Sample data for testing
insert into industry_crosswalk (naics_code, naics_label, apollo_label, hubspot_value, linkedin_value, sic_code) values
  ('541512', 'Computer Systems Design Services', 'Computer Software', 'COMPUTER_SOFTWARE', 'Computer Software', '7371'),
  ('541511', 'Custom Computer Programming Services', 'Computer Software', 'COMPUTER_SOFTWARE', 'Computer Software', '7371'),
  ('518210', 'Data Processing, Hosting, and Related Services', 'Information Technology & Services', 'IT_SERVICES', 'Information Technology and Services', '7374'),
  ('519130', 'Internet Publishing and Broadcasting and Web Search Portals', 'Internet', 'INTERNET', 'Internet', '7375'),
  ('522110', 'Commercial Banking', 'Banking', 'BANKING', 'Banking', '6021'),
  ('522298', 'All Other Nondepository Credit Intermediation', 'Financial Services', 'FINANCIAL_SERVICES', 'Financial Services', '6141'),
  ('524210', 'Insurance Agencies and Brokerages', 'Insurance', 'INSURANCE', 'Insurance', '6411'),
  ('621111', 'Offices of Physicians (except Mental Health Specialists)', 'Hospital & Health Care', 'HOSPITAL_HEALTH_CARE', 'Hospital & Health Care', '8011'),
  ('611710', 'Educational Support Services', 'Education Management', 'EDUCATION_MANAGEMENT', 'Education Management', '8299'),
  ('238210', 'Electrical Contractors and Other Wiring Installation Contractors', 'Construction', 'CONSTRUCTION', 'Construction', '1731')
on conflict (naics_code) do nothing;
