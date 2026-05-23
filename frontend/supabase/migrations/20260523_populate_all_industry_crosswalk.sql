-- Populate industry_crosswalk with all 148 HubSpot standard industry enum values
-- Maps HubSpot enums to NAICS codes and provider label variants

-- PRIORITY MAPPINGS (most common in Frontera portal)
insert into industry_crosswalk (naics_code, naics_label, apollo_label, hubspot_value, linkedin_value, sic_code) values
  -- HOSPITAL_HEALTH_CARE
  ('621111', 'Offices of Physicians', 'Hospital & Health Care', 'HOSPITAL_HEALTH_CARE', 'Hospital & Health Care', '8011'),
  ('622110', 'General Medical and Surgical Hospitals', 'Hospital & Health Care', 'HOSPITAL_HEALTH_CARE', 'Hospital & Health Care', '8062'),
  ('621491', 'HMO Medical Centers', 'Hospital & Health Care', 'HOSPITAL_HEALTH_CARE', 'Hospital & Health Care', '8011'),

  -- MENTAL_HEALTH_CARE
  ('621112', 'Offices of Physicians, Mental Health Specialists', 'Mental Health Care', 'MENTAL_HEALTH_CARE', 'Mental Health Care', '8011'),
  ('623220', 'Residential Mental Health Facilities', 'Mental Health Care', 'MENTAL_HEALTH_CARE', 'Mental Health Care', '8361'),
  ('621420', 'Outpatient Mental Health Centers', 'Mental Health Care', 'MENTAL_HEALTH_CARE', 'Mental Health Care', '8093'),

  -- INDIVIDUAL_FAMILY_SERVICES
  ('624110', 'Child and Youth Services', 'Individual & Family Services', 'INDIVIDUAL_FAMILY_SERVICES', 'Individual & Family Services', '8322'),
  ('624190', 'Other Individual and Family Services', 'Individual & Family Services', 'INDIVIDUAL_FAMILY_SERVICES', 'Individual & Family Services', '8322'),
  ('624120', 'Services for the Elderly and Persons with Disabilities', 'Individual & Family Services', 'INDIVIDUAL_FAMILY_SERVICES', 'Individual & Family Services', '8322'),

  -- HEALTH_WELLNESS_AND_FITNESS
  ('713940', 'Fitness and Recreational Sports Centers', 'Health, Wellness and Fitness', 'HEALTH_WELLNESS_AND_FITNESS', 'Health, Wellness & Fitness', '7991'),
  ('812191', 'Diet and Weight Reducing Centers', 'Health, Wellness and Fitness', 'HEALTH_WELLNESS_AND_FITNESS', 'Health, Wellness & Fitness', '7299'),
  ('621399', 'Offices of All Other Miscellaneous Health Practitioners', 'Health, Wellness and Fitness', 'HEALTH_WELLNESS_AND_FITNESS', 'Health, Wellness & Fitness', '8049'),

  -- CONSUMER_SERVICES
  ('812990', 'All Other Personal Services', 'Consumer Services', 'CONSUMER_SERVICES', 'Consumer Services', '7299'),
  ('561990', 'All Other Support Services', 'Consumer Services', 'CONSUMER_SERVICES', 'Consumer Services', '7389'),

  -- INFORMATION_TECHNOLOGY_AND_SERVICES
  ('518210', 'Data Processing, Hosting, and Related Services', 'Information Technology & Services', 'INFORMATION_TECHNOLOGY_AND_SERVICES', 'Information Technology and Services', '7374'),
  ('541512', 'Computer Systems Design Services', 'Information Technology & Services', 'INFORMATION_TECHNOLOGY_AND_SERVICES', 'Information Technology and Services', '7371'),
  ('541519', 'Other Computer Related Services', 'Information Technology & Services', 'INFORMATION_TECHNOLOGY_AND_SERVICES', 'Information Technology and Services', '7379'),

  -- COMPUTER_SOFTWARE
  ('511210', 'Software Publishers', 'Computer Software', 'COMPUTER_SOFTWARE', 'Computer Software', '7372'),
  ('541511', 'Custom Computer Programming Services', 'Computer Software', 'COMPUTER_SOFTWARE', 'Computer Software', '7371')
on conflict (naics_code) do update set
  hubspot_value = excluded.hubspot_value,
  apollo_label = excluded.apollo_label,
  linkedin_value = excluded.linkedin_value;

-- ALL 148 HUBSPOT INDUSTRY VALUES
insert into industry_crosswalk (naics_code, naics_label, apollo_label, hubspot_value, linkedin_value, sic_code) values
  -- ACCOUNTING
  ('541211', 'Offices of Certified Public Accountants', 'Accounting', 'ACCOUNTING', 'Accounting', '8721'),
  ('541219', 'Other Accounting Services', 'Accounting', 'ACCOUNTING', 'Accounting', '8721'),

  -- AIRLINES_AVIATION
  ('481111', 'Scheduled Passenger Air Transportation', 'Airlines/Aviation', 'AIRLINES_AVIATION', 'Airlines/Aviation', '4512'),
  ('481211', 'Nonscheduled Chartered Passenger Air Transportation', 'Airlines/Aviation', 'AIRLINES_AVIATION', 'Airlines/Aviation', '4522'),

  -- ALTERNATIVE_DISPUTE_RESOLUTION
  ('541110', 'Offices of Lawyers', 'Alternative Dispute Resolution', 'ALTERNATIVE_DISPUTE_RESOLUTION', 'Alternative Dispute Resolution', '8111'),

  -- ALTERNATIVE_MEDICINE
  ('621399', 'Offices of All Other Miscellaneous Health Practitioners', 'Alternative Medicine', 'ALTERNATIVE_MEDICINE', 'Alternative Medicine', '8049'),

  -- ANIMATION
  ('512110', 'Motion Picture and Video Production', 'Animation', 'ANIMATION', 'Animation', '7812'),

  -- APPAREL_FASHION
  ('315000', 'Apparel Manufacturing', 'Apparel & Fashion', 'APPAREL_FASHION', 'Apparel & Fashion', '2300'),
  ('448000', 'Clothing and Clothing Accessories Stores', 'Apparel & Fashion', 'APPAREL_FASHION', 'Apparel & Fashion', '5600'),

  -- ARCHITECTURE_PLANNING
  ('541310', 'Architectural Services', 'Architecture & Planning', 'ARCHITECTURE_PLANNING', 'Architecture & Planning', '8712'),
  ('541320', 'Landscape Architectural Services', 'Architecture & Planning', 'ARCHITECTURE_PLANNING', 'Architecture & Planning', '0781'),

  -- ARTS_AND_CRAFTS
  ('711510', 'Independent Artists, Writers, and Performers', 'Arts and Crafts', 'ARTS_AND_CRAFTS', 'Arts and Crafts', '7819'),

  -- AUTOMOTIVE
  ('441000', 'Motor Vehicle and Parts Dealers', 'Automotive', 'AUTOMOTIVE', 'Automotive', '5500'),
  ('336000', 'Transportation Equipment Manufacturing', 'Automotive', 'AUTOMOTIVE', 'Automotive', '3700'),

  -- AVIATION_AEROSPACE
  ('336411', 'Aircraft Manufacturing', 'Aviation & Aerospace', 'AVIATION_AEROSPACE', 'Aviation & Aerospace', '3721'),

  -- BANKING
  ('522110', 'Commercial Banking', 'Banking', 'BANKING', 'Banking', '6021'),
  ('522120', 'Savings Institutions', 'Banking', 'BANKING', 'Banking', '6035'),

  -- BIOTECHNOLOGY
  ('541714', 'Research and Development in Biotechnology', 'Biotechnology', 'BIOTECHNOLOGY', 'Biotechnology', '8731'),

  -- BROADCAST_MEDIA
  ('515112', 'Radio Stations', 'Broadcast Media', 'BROADCAST_MEDIA', 'Broadcast Media', '4832'),
  ('515120', 'Television Broadcasting', 'Broadcast Media', 'BROADCAST_MEDIA', 'Broadcast Media', '4833'),

  -- BUILDING_MATERIALS
  ('444000', 'Building Material and Garden Equipment Dealers', 'Building Materials', 'BUILDING_MATERIALS', 'Building Materials', '5200'),

  -- BUSINESS_SUPPLIES_AND_EQUIPMENT
  ('423000', 'Merchant Wholesalers, Durable Goods', 'Business Supplies and Equipment', 'BUSINESS_SUPPLIES_AND_EQUIPMENT', 'Business Supplies and Equipment', '5000'),

  -- CAPITAL_MARKETS
  ('523000', 'Securities, Commodity Contracts, and Other Financial Investments', 'Capital Markets', 'CAPITAL_MARKETS', 'Capital Markets', '6200'),

  -- CHEMICALS
  ('325000', 'Chemical Manufacturing', 'Chemicals', 'CHEMICALS', 'Chemicals', '2800'),

  -- CIVIC_SOCIAL_ORGANIZATION
  ('813000', 'Religious, Grantmaking, Civic, Professional Organizations', 'Civic & Social Organization', 'CIVIC_SOCIAL_ORGANIZATION', 'Civic & Social Organization', '8600'),

  -- CIVIL_ENGINEERING
  ('541330', 'Engineering Services', 'Civil Engineering', 'CIVIL_ENGINEERING', 'Civil Engineering', '8711'),

  -- COMMERCIAL_REAL_ESTATE
  ('531120', 'Lessors of Nonresidential Buildings', 'Commercial Real Estate', 'COMMERCIAL_REAL_ESTATE', 'Commercial Real Estate', '6512'),

  -- COMPUTER_GAMES
  ('511210', 'Software Publishers', 'Computer Games', 'COMPUTER_GAMES', 'Computer Games', '7372'),

  -- COMPUTER_HARDWARE
  ('334111', 'Electronic Computer Manufacturing', 'Computer Hardware', 'COMPUTER_HARDWARE', 'Computer Hardware', '3571'),

  -- COMPUTER_NETWORKING
  ('334210', 'Telephone Apparatus Manufacturing', 'Computer Networking', 'COMPUTER_NETWORKING', 'Computer Networking', '3661'),

  -- COMPUTER_NETWORK_SECURITY
  ('541512', 'Computer Systems Design Services', 'Computer & Network Security', 'COMPUTER_NETWORK_SECURITY', 'Computer & Network Security', '7371'),

  -- CONSTRUCTION
  ('236000', 'Construction of Buildings', 'Construction', 'CONSTRUCTION', 'Construction', '1500'),
  ('237000', 'Heavy and Civil Engineering Construction', 'Construction', 'CONSTRUCTION', 'Construction', '1600'),

  -- CONSUMER_ELECTRONICS
  ('334310', 'Audio and Video Equipment Manufacturing', 'Consumer Electronics', 'CONSUMER_ELECTRONICS', 'Consumer Electronics', '3651'),

  -- CONSUMER_GOODS
  ('311000', 'Food Manufacturing', 'Consumer Goods', 'CONSUMER_GOODS', 'Consumer Goods', '2000'),

  -- COSMETICS
  ('325620', 'Toilet Preparation Manufacturing', 'Cosmetics', 'COSMETICS', 'Cosmetics', '2844'),

  -- DAIRY
  ('311500', 'Dairy Product Manufacturing', 'Dairy', 'DAIRY', 'Dairy', '2020'),

  -- DEFENSE_SPACE
  ('336414', 'Guided Missile and Space Vehicle Manufacturing', 'Defense & Space', 'DEFENSE_SPACE', 'Defense & Space', '3761'),

  -- DESIGN
  ('541400', 'Specialized Design Services', 'Design', 'DESIGN', 'Design', '7389'),

  -- EDUCATION_MANAGEMENT
  ('611710', 'Educational Support Services', 'Education Management', 'EDUCATION_MANAGEMENT', 'Education Management', '8299'),

  -- E_LEARNING
  ('611710', 'Educational Support Services', 'E-Learning', 'E_LEARNING', 'E-Learning', '8299'),

  -- ELECTRICAL_ELECTRONIC_MANUFACTURING
  ('335000', 'Electrical Equipment, Appliance, and Component Manufacturing', 'Electrical/Electronic Manufacturing', 'ELECTRICAL_ELECTRONIC_MANUFACTURING', 'Electrical & Electronic Manufacturing', '3600'),

  -- ENTERTAINMENT
  ('711000', 'Performing Arts, Spectator Sports, and Related Industries', 'Entertainment', 'ENTERTAINMENT', 'Entertainment', '7900'),

  -- ENVIRONMENTAL_SERVICES
  ('562000', 'Waste Management and Remediation Services', 'Environmental Services', 'ENVIRONMENTAL_SERVICES', 'Environmental Services', '4950'),

  -- EVENTS_SERVICES
  ('561920', 'Convention and Trade Show Organizers', 'Events Services', 'EVENTS_SERVICES', 'Events Services', '7389'),

  -- EXECUTIVE_OFFICE
  ('561110', 'Office Administrative Services', 'Executive Office', 'EXECUTIVE_OFFICE', 'Executive Office', '8741'),

  -- FACILITIES_SERVICES
  ('561210', 'Facilities Support Services', 'Facilities Services', 'FACILITIES_SERVICES', 'Facilities Services', '8744'),

  -- FARMING
  ('111000', 'Crop Production', 'Farming', 'FARMING', 'Farming', '0100'),

  -- FINANCIAL_SERVICES
  ('522298', 'All Other Nondepository Credit Intermediation', 'Financial Services', 'FINANCIAL_SERVICES', 'Financial Services', '6141'),
  ('523920', 'Portfolio Management', 'Financial Services', 'FINANCIAL_SERVICES', 'Financial Services', '6282'),

  -- FINE_ART
  ('711510', 'Independent Artists, Writers, and Performers', 'Fine Art', 'FINE_ART', 'Fine Art', '7819'),

  -- FISHERY
  ('114000', 'Fishing, Hunting and Trapping', 'Fishery', 'FISHERY', 'Fishery', '0900'),

  -- FOOD_BEVERAGES
  ('311000', 'Food Manufacturing', 'Food & Beverages', 'FOOD_BEVERAGES', 'Food & Beverages', '2000'),
  ('312000', 'Beverage and Tobacco Product Manufacturing', 'Food & Beverages', 'FOOD_BEVERAGES', 'Food & Beverages', '2080'),

  -- FOOD_PRODUCTION
  ('311000', 'Food Manufacturing', 'Food Production', 'FOOD_PRODUCTION', 'Food Production', '2000'),

  -- FUND_RAISING
  ('813211', 'Grantmaking Foundations', 'Fund-Raising', 'FUND_RAISING', 'Fund-Raising', '8733'),

  -- FURNITURE
  ('337000', 'Furniture and Related Product Manufacturing', 'Furniture', 'FURNITURE', 'Furniture', '2500'),

  -- GAMBLING_CASINOS
  ('713210', 'Casinos', 'Gambling & Casinos', 'GAMBLING_CASINOS', 'Gambling & Casinos', '7999'),

  -- GLASS_CERAMICS_CONCRETE
  ('327000', 'Nonmetallic Mineral Product Manufacturing', 'Glass, Ceramics & Concrete', 'GLASS_CERAMICS_CONCRETE', 'Glass, Ceramics & Concrete', '3200'),

  -- GOVERNMENT_ADMINISTRATION
  ('921110', 'Executive Offices', 'Government Administration', 'GOVERNMENT_ADMINISTRATION', 'Government Administration', '9111'),

  -- GOVERNMENT_RELATIONS
  ('541820', 'Public Relations Agencies', 'Government Relations', 'GOVERNMENT_RELATIONS', 'Government Relations', '8743'),

  -- GRAPHIC_DESIGN
  ('541430', 'Graphic Design Services', 'Graphic Design', 'GRAPHIC_DESIGN', 'Graphic Design', '7336'),

  -- HIGHER_EDUCATION
  ('611310', 'Colleges, Universities, and Professional Schools', 'Higher Education', 'HIGHER_EDUCATION', 'Higher Education', '8221'),

  -- HOSPITAL_HEALTH_CARE (already added in priority section)

  -- HOSPITALITY
  ('721110', 'Hotels and Motels', 'Hospitality', 'HOSPITALITY', 'Hospitality', '7011'),

  -- HUMAN_RESOURCES
  ('561311', 'Employment Placement Agencies', 'Human Resources', 'HUMAN_RESOURCES', 'Human Resources', '7361'),

  -- IMPORT_AND_EXPORT
  ('425120', 'Wholesale Trade Agents and Brokers', 'Import and Export', 'IMPORT_AND_EXPORT', 'Import and Export', '5199'),

  -- INDIVIDUAL_FAMILY_SERVICES (already added in priority section)

  -- INDUSTRIAL_AUTOMATION
  ('333000', 'Machinery Manufacturing', 'Industrial Automation', 'INDUSTRIAL_AUTOMATION', 'Industrial Automation', '3500'),

  -- INFORMATION_SERVICES
  ('519190', 'All Other Information Services', 'Information Services', 'INFORMATION_SERVICES', 'Information Services', '7375'),

  -- INFORMATION_TECHNOLOGY_AND_SERVICES (already added in priority section)

  -- INSURANCE
  ('524210', 'Insurance Agencies and Brokerages', 'Insurance', 'INSURANCE', 'Insurance', '6411'),
  ('524113', 'Direct Life Insurance Carriers', 'Insurance', 'INSURANCE', 'Insurance', '6311'),

  -- INTERNATIONAL_AFFAIRS
  ('926110', 'Administration of General Economic Programs', 'International Affairs', 'INTERNATIONAL_AFFAIRS', 'International Affairs', '9611'),

  -- INTERNATIONAL_TRADE_AND_DEVELOPMENT
  ('926110', 'Administration of General Economic Programs', 'International Trade and Development', 'INTERNATIONAL_TRADE_AND_DEVELOPMENT', 'International Trade and Development', '9611'),

  -- INTERNET
  ('519130', 'Internet Publishing and Broadcasting and Web Search Portals', 'Internet', 'INTERNET', 'Internet', '7375'),

  -- INVESTMENT_BANKING
  ('523110', 'Investment Banking and Securities Dealing', 'Investment Banking', 'INVESTMENT_BANKING', 'Investment Banking', '6211'),

  -- INVESTMENT_MANAGEMENT
  ('523920', 'Portfolio Management', 'Investment Management', 'INVESTMENT_MANAGEMENT', 'Investment Management', '6282'),

  -- JUDICIARY
  ('922110', 'Courts', 'Judiciary', 'JUDICIARY', 'Judiciary', '9211'),

  -- LAW_ENFORCEMENT
  ('922120', 'Police Protection', 'Law Enforcement', 'LAW_ENFORCEMENT', 'Law Enforcement', '9221'),

  -- LAW_PRACTICE
  ('541110', 'Offices of Lawyers', 'Law Practice', 'LAW_PRACTICE', 'Law Practice', '8111'),

  -- LEGAL_SERVICES
  ('541110', 'Offices of Lawyers', 'Legal Services', 'LEGAL_SERVICES', 'Legal Services', '8111'),

  -- LEGISLATIVE_OFFICE
  ('921120', 'Legislative Bodies', 'Legislative Office', 'LEGISLATIVE_OFFICE', 'Legislative Office', '9121'),

  -- LEISURE_TRAVEL_TOURISM
  ('561510', 'Travel Agencies', 'Leisure, Travel & Tourism', 'LEISURE_TRAVEL_TOURISM', 'Leisure, Travel & Tourism', '4724'),

  -- LIBRARIES
  ('519120', 'Libraries and Archives', 'Libraries', 'LIBRARIES', 'Libraries', '8231'),

  -- LOGISTICS_AND_SUPPLY_CHAIN
  ('493000', 'Warehousing and Storage', 'Logistics and Supply Chain', 'LOGISTICS_AND_SUPPLY_CHAIN', 'Logistics and Supply Chain', '4220'),

  -- LUXURY_GOODS_JEWELRY
  ('448310', 'Jewelry Stores', 'Luxury Goods & Jewelry', 'LUXURY_GOODS_JEWELRY', 'Luxury Goods & Jewelry', '5944'),

  -- MACHINERY
  ('333000', 'Machinery Manufacturing', 'Machinery', 'MACHINERY', 'Machinery', '3500'),

  -- MANAGEMENT_CONSULTING
  ('541611', 'Administrative Management and General Management Consulting', 'Management Consulting', 'MANAGEMENT_CONSULTING', 'Management Consulting', '8742'),

  -- MARITIME
  ('483000', 'Water Transportation', 'Maritime', 'MARITIME', 'Maritime', '4400'),

  -- MARKET_RESEARCH
  ('541910', 'Marketing Research and Public Opinion Polling', 'Market Research', 'MARKET_RESEARCH', 'Market Research', '8732'),

  -- MARKETING_AND_ADVERTISING
  ('541810', 'Advertising Agencies', 'Marketing and Advertising', 'MARKETING_AND_ADVERTISING', 'Marketing and Advertising', '7311'),

  -- MECHANICAL_OR_INDUSTRIAL_ENGINEERING
  ('541330', 'Engineering Services', 'Mechanical or Industrial Engineering', 'MECHANICAL_OR_INDUSTRIAL_ENGINEERING', 'Mechanical or Industrial Engineering', '8711'),

  -- MEDIA_PRODUCTION
  ('512110', 'Motion Picture and Video Production', 'Media Production', 'MEDIA_PRODUCTION', 'Media Production', '7812'),

  -- MEDICAL_DEVICES
  ('339112', 'Surgical and Medical Instrument Manufacturing', 'Medical Devices', 'MEDICAL_DEVICES', 'Medical Devices', '3841'),

  -- MEDICAL_PRACTICE
  ('621111', 'Offices of Physicians', 'Medical Practice', 'MEDICAL_PRACTICE', 'Medical Practice', '8011'),

  -- MENTAL_HEALTH_CARE (already added in priority section)

  -- MILITARY
  ('928110', 'National Security', 'Military', 'MILITARY', 'Military', '9711'),

  -- MINING_METALS
  ('212000', 'Mining', 'Mining & Metals', 'MINING_METALS', 'Mining & Metals', '1000'),

  -- MOTION_PICTURES_AND_FILM
  ('512110', 'Motion Picture and Video Production', 'Motion Pictures and Film', 'MOTION_PICTURES_AND_FILM', 'Motion Pictures and Film', '7812'),

  -- MUSEUMS_AND_INSTITUTIONS
  ('712110', 'Museums', 'Museums and Institutions', 'MUSEUMS_AND_INSTITUTIONS', 'Museums and Institutions', '8412'),

  -- MUSIC
  ('512230', 'Music Publishers', 'Music', 'MUSIC', 'Music', '2741'),

  -- NANOTECHNOLOGY
  ('541714', 'Research and Development in Biotechnology', 'Nanotechnology', 'NANOTECHNOLOGY', 'Nanotechnology', '8731'),

  -- NEWSPAPERS
  ('511110', 'Newspaper Publishers', 'Newspapers', 'NEWSPAPERS', 'Newspapers', '2711'),

  -- NON_PROFIT_ORGANIZATION_MANAGEMENT
  ('813000', 'Religious, Grantmaking, Civic, Professional Organizations', 'Non-Profit Organization Management', 'NON_PROFIT_ORGANIZATION_MANAGEMENT', 'Nonprofit Organization Management', '8600'),

  -- OIL_ENERGY
  ('211000', 'Oil and Gas Extraction', 'Oil & Energy', 'OIL_ENERGY', 'Oil & Energy', '1300'),

  -- ONLINE_MEDIA
  ('519130', 'Internet Publishing and Broadcasting and Web Search Portals', 'Online Media', 'ONLINE_MEDIA', 'Online Media', '7375'),

  -- OUTSOURCING_OFFSHORING
  ('561000', 'Administrative and Support Services', 'Outsourcing/Offshoring', 'OUTSOURCING_OFFSHORING', 'Outsourcing/Offshoring', '7360'),

  -- PACKAGE_FREIGHT_DELIVERY
  ('492110', 'Couriers and Express Delivery Services', 'Package/Freight Delivery', 'PACKAGE_FREIGHT_DELIVERY', 'Package/Freight Delivery', '4215'),

  -- PACKAGING_AND_CONTAINERS
  ('326000', 'Plastics and Rubber Products Manufacturing', 'Packaging and Containers', 'PACKAGING_AND_CONTAINERS', 'Packaging and Containers', '3080'),

  -- PAPER_FOREST_PRODUCTS
  ('322000', 'Paper Manufacturing', 'Paper & Forest Products', 'PAPER_FOREST_PRODUCTS', 'Paper & Forest Products', '2600'),

  -- PERFORMING_ARTS
  ('711100', 'Performing Arts Companies', 'Performing Arts', 'PERFORMING_ARTS', 'Performing Arts', '7922'),

  -- PHARMACEUTICALS
  ('325412', 'Pharmaceutical Preparation Manufacturing', 'Pharmaceuticals', 'PHARMACEUTICALS', 'Pharmaceuticals', '2834'),

  -- PHILANTHROPY
  ('813211', 'Grantmaking Foundations', 'Philanthropy', 'PHILANTHROPY', 'Philanthropy', '8733'),

  -- PHOTOGRAPHY
  ('541921', 'Photography Studios, Portrait', 'Photography', 'PHOTOGRAPHY', 'Photography', '7221'),

  -- PLASTICS
  ('326000', 'Plastics and Rubber Products Manufacturing', 'Plastics', 'PLASTICS', 'Plastics', '3080'),

  -- POLITICAL_ORGANIZATION
  ('813940', 'Political Organizations', 'Political Organization', 'POLITICAL_ORGANIZATION', 'Political Organization', '8651'),

  -- PRIMARY_SECONDARY_EDUCATION
  ('611110', 'Elementary and Secondary Schools', 'Primary/Secondary Education', 'PRIMARY_SECONDARY_EDUCATION', 'Primary/Secondary Education', '8211'),

  -- PRINTING
  ('323000', 'Printing and Related Support Activities', 'Printing', 'PRINTING', 'Printing', '2700'),

  -- PROFESSIONAL_TRAINING_COACHING
  ('611430', 'Professional and Management Development Training', 'Professional Training & Coaching', 'PROFESSIONAL_TRAINING_COACHING', 'Professional Training & Coaching', '8299'),

  -- PROGRAM_DEVELOPMENT
  ('541512', 'Computer Systems Design Services', 'Program Development', 'PROGRAM_DEVELOPMENT', 'Program Development', '7371'),

  -- PUBLIC_POLICY
  ('541820', 'Public Relations Agencies', 'Public Policy', 'PUBLIC_POLICY', 'Public Policy', '8743'),

  -- PUBLIC_RELATIONS_AND_COMMUNICATIONS
  ('541820', 'Public Relations Agencies', 'Public Relations and Communications', 'PUBLIC_RELATIONS_AND_COMMUNICATIONS', 'Public Relations and Communications', '8743'),

  -- PUBLIC_SAFETY
  ('922160', 'Fire Protection', 'Public Safety', 'PUBLIC_SAFETY', 'Public Safety', '9224'),

  -- PUBLISHING
  ('511000', 'Publishing Industries', 'Publishing', 'PUBLISHING', 'Publishing', '2700'),

  -- RAILROAD_MANUFACTURE
  ('336510', 'Railroad Rolling Stock Manufacturing', 'Railroad Manufacture', 'RAILROAD_MANUFACTURE', 'Railroad Manufacture', '3743'),

  -- RANCHING
  ('112000', 'Animal Production and Aquaculture', 'Ranching', 'RANCHING', 'Ranching', '0200'),

  -- REAL_ESTATE
  ('531210', 'Offices of Real Estate Agents and Brokers', 'Real Estate', 'REAL_ESTATE', 'Real Estate', '6531'),

  -- RECREATIONAL_FACILITIES_AND_SERVICES
  ('713900', 'Other Amusement and Recreation Industries', 'Recreational Facilities and Services', 'RECREATIONAL_FACILITIES_AND_SERVICES', 'Recreational Facilities and Services', '7999'),

  -- RELIGIOUS_INSTITUTIONS
  ('813110', 'Religious Organizations', 'Religious Institutions', 'RELIGIOUS_INSTITUTIONS', 'Religious Institutions', '8661'),

  -- RENEWABLES_ENVIRONMENT
  ('221114', 'Solar Electric Power Generation', 'Renewables & Environment', 'RENEWABLES_ENVIRONMENT', 'Renewables & Environment', '4911'),

  -- RESEARCH
  ('541710', 'Research and Development in the Physical, Engineering, and Life Sciences', 'Research', 'RESEARCH', 'Research', '8731'),

  -- RESTAURANTS
  ('722511', 'Full-Service Restaurants', 'Restaurants', 'RESTAURANTS', 'Restaurants', '5812'),

  -- RETAIL
  ('452000', 'General Merchandise Stores', 'Retail', 'RETAIL', 'Retail', '5300'),

  -- SECURITY_AND_INVESTIGATIONS
  ('561612', 'Security Guards and Patrol Services', 'Security and Investigations', 'SECURITY_AND_INVESTIGATIONS', 'Security and Investigations', '7381'),

  -- SEMICONDUCTORS
  ('334413', 'Semiconductor and Related Device Manufacturing', 'Semiconductors', 'SEMICONDUCTORS', 'Semiconductors', '3674'),

  -- SHIPBUILDING
  ('336611', 'Ship Building and Repairing', 'Shipbuilding', 'SHIPBUILDING', 'Shipbuilding', '3731'),

  -- SPORTING_GOODS
  ('339920', 'Sporting and Athletic Goods Manufacturing', 'Sporting Goods', 'SPORTING_GOODS', 'Sporting Goods', '3949'),

  -- SPORTS
  ('711211', 'Sports Teams and Clubs', 'Sports', 'SPORTS', 'Sports', '7941'),

  -- STAFFING_AND_RECRUITING
  ('561311', 'Employment Placement Agencies', 'Staffing and Recruiting', 'STAFFING_AND_RECRUITING', 'Staffing and Recruiting', '7361'),

  -- SUPERMARKETS
  ('445110', 'Supermarkets and Other Grocery Stores', 'Supermarkets', 'SUPERMARKETS', 'Supermarkets', '5411'),

  -- TELECOMMUNICATIONS
  ('517000', 'Telecommunications', 'Telecommunications', 'TELECOMMUNICATIONS', 'Telecommunications', '4800'),

  -- TEXTILES
  ('313000', 'Textile Mills', 'Textiles', 'TEXTILES', 'Textiles', '2200'),

  -- THINK_TANKS
  ('541720', 'Research and Development in the Social Sciences and Humanities', 'Think Tanks', 'THINK_TANKS', 'Think Tanks', '8733'),

  -- TOBACCO
  ('312230', 'Tobacco Manufacturing', 'Tobacco', 'TOBACCO', 'Tobacco', '2100'),

  -- TRANSLATION_AND_LOCALIZATION
  ('541930', 'Translation and Interpretation Services', 'Translation and Localization', 'TRANSLATION_AND_LOCALIZATION', 'Translation and Localization', '7389'),

  -- TRANSPORTATION_TRUCKING_RAILROAD
  ('484000', 'Truck Transportation', 'Transportation/Trucking/Railroad', 'TRANSPORTATION_TRUCKING_RAILROAD', 'Transportation/Trucking/Railroad', '4200'),

  -- UTILITIES
  ('221000', 'Utilities', 'Utilities', 'UTILITIES', 'Utilities', '4900'),

  -- VENTURE_CAPITAL_PRIVATE_EQUITY
  ('523910', 'Miscellaneous Intermediation', 'Venture Capital & Private Equity', 'VENTURE_CAPITAL_PRIVATE_EQUITY', 'Venture Capital & Private Equity', '6799'),

  -- VETERINARY
  ('541940', 'Veterinary Services', 'Veterinary', 'VETERINARY', 'Veterinary', '0742'),

  -- WAREHOUSING
  ('493000', 'Warehousing and Storage', 'Warehousing', 'WAREHOUSING', 'Warehousing', '4220'),

  -- WHOLESALE
  ('423000', 'Merchant Wholesalers, Durable Goods', 'Wholesale', 'WHOLESALE', 'Wholesale', '5000'),

  -- WINE_AND_SPIRITS
  ('312130', 'Wineries', 'Wine and Spirits', 'WINE_AND_SPIRITS', 'Wine and Spirits', '2084'),

  -- WIRELESS
  ('517312', 'Wireless Telecommunications Carriers', 'Wireless', 'WIRELESS', 'Wireless', '4812'),

  -- WRITING_AND_EDITING
  ('711510', 'Independent Artists, Writers, and Performers', 'Writing and Editing', 'WRITING_AND_EDITING', 'Writing and Editing', '7819')
on conflict (naics_code) do update set
  hubspot_value = excluded.hubspot_value,
  apollo_label = excluded.apollo_label,
  linkedin_value = excluded.linkedin_value;
