'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { getCountries, getCountryCallingCode } from 'libphonenumber-js';
import { C, F } from '@/lib/design-tokens';

interface SearchableCountrySelectProps {
  value: string; // Country calling code (e.g., "1", "44", "61") - not ISO code
  onChange: (countryCode: string) => void;
  style?: React.CSSProperties;
}

// Map country codes to full names
const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  GB: 'United Kingdom',
  AU: 'Australia',
  CA: 'Canada',
  FR: 'France',
  DE: 'Germany',
  IN: 'India',
  JP: 'Japan',
  CN: 'China',
  BR: 'Brazil',
  MX: 'Mexico',
  IT: 'Italy',
  ES: 'Spain',
  NL: 'Netherlands',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  FI: 'Finland',
  BE: 'Belgium',
  CH: 'Switzerland',
  AT: 'Austria',
  IE: 'Ireland',
  NZ: 'New Zealand',
  SG: 'Singapore',
  HK: 'Hong Kong',
  KR: 'South Korea',
  TW: 'Taiwan',
  MY: 'Malaysia',
  TH: 'Thailand',
  ID: 'Indonesia',
  PH: 'Philippines',
  VN: 'Vietnam',
  ZA: 'South Africa',
  EG: 'Egypt',
  NG: 'Nigeria',
  KE: 'Kenya',
  AE: 'United Arab Emirates',
  SA: 'Saudi Arabia',
  IL: 'Israel',
  PL: 'Poland',
  CZ: 'Czech Republic',
  RO: 'Romania',
  HU: 'Hungary',
  GR: 'Greece',
  PT: 'Portugal',
  RU: 'Russia',
  UA: 'Ukraine',
  TR: 'Turkey',
  AR: 'Argentina',
  CL: 'Chile',
  CO: 'Colombia',
  PE: 'Peru',
  VE: 'Venezuela',
  PK: 'Pakistan',
  BD: 'Bangladesh',
  LK: 'Sri Lanka',
  NP: 'Nepal',
  AF: 'Afghanistan',
  IQ: 'Iraq',
  IR: 'Iran',
  KW: 'Kuwait',
  OM: 'Oman',
  QA: 'Qatar',
  BH: 'Bahrain',
  JO: 'Jordan',
  LB: 'Lebanon',
  MA: 'Morocco',
  DZ: 'Algeria',
  TN: 'Tunisia',
  LY: 'Libya',
  ET: 'Ethiopia',
  GH: 'Ghana',
  TZ: 'Tanzania',
  UG: 'Uganda',
  ZM: 'Zambia',
  ZW: 'Zimbabwe',
  BW: 'Botswana',
  MZ: 'Mozambique',
  AO: 'Angola',
  CD: 'Democratic Republic of the Congo',
  CI: 'Ivory Coast',
  CM: 'Cameroon',
  SN: 'Senegal',
  ML: 'Mali',
  BF: 'Burkina Faso',
  NE: 'Niger',
  TD: 'Chad',
  SO: 'Somalia',
  RW: 'Rwanda',
  BI: 'Burundi',
  MG: 'Madagascar',
  MU: 'Mauritius',
  RE: 'Réunion',
  YT: 'Mayotte',
  SC: 'Seychelles',
  KM: 'Comoros',
  IS: 'Iceland',
  LU: 'Luxembourg',
  MT: 'Malta',
  CY: 'Cyprus',
  EE: 'Estonia',
  LV: 'Latvia',
  LT: 'Lithuania',
  SI: 'Slovenia',
  SK: 'Slovakia',
  BG: 'Bulgaria',
  HR: 'Croatia',
  BA: 'Bosnia and Herzegovina',
  RS: 'Serbia',
  ME: 'Montenegro',
  MK: 'North Macedonia',
  AL: 'Albania',
  XK: 'Kosovo',
  MD: 'Moldova',
  BY: 'Belarus',
  AM: 'Armenia',
  AZ: 'Azerbaijan',
  GE: 'Georgia',
  KZ: 'Kazakhstan',
  UZ: 'Uzbekistan',
  TM: 'Turkmenistan',
  KG: 'Kyrgyzstan',
  TJ: 'Tajikistan',
  MN: 'Mongolia',
  BT: 'Bhutan',
  MM: 'Myanmar',
  LA: 'Laos',
  KH: 'Cambodia',
  BN: 'Brunei',
  TL: 'Timor-Leste',
  PG: 'Papua New Guinea',
  FJ: 'Fiji',
  NC: 'New Caledonia',
  PF: 'French Polynesia',
  WS: 'Samoa',
  TO: 'Tonga',
  VU: 'Vanuatu',
  SB: 'Solomon Islands',
  KI: 'Kiribati',
  FM: 'Micronesia',
  MH: 'Marshall Islands',
  PW: 'Palau',
  NR: 'Nauru',
  TV: 'Tuvalu',
  CK: 'Cook Islands',
  NU: 'Niue',
  TK: 'Tokelau',
  AS: 'American Samoa',
  GU: 'Guam',
  MP: 'Northern Mariana Islands',
  PR: 'Puerto Rico',
  VI: 'U.S. Virgin Islands',
  VG: 'British Virgin Islands',
  KY: 'Cayman Islands',
  BM: 'Bermuda',
  TC: 'Turks and Caicos Islands',
  MS: 'Montserrat',
  AI: 'Anguilla',
  BL: 'Saint Barthélemy',
  MF: 'Saint Martin',
  PM: 'Saint Pierre and Miquelon',
  GF: 'French Guiana',
  GP: 'Guadeloupe',
  MQ: 'Martinique',
  SR: 'Suriname',
  GY: 'Guyana',
  BZ: 'Belize',
  CR: 'Costa Rica',
  SV: 'El Salvador',
  GT: 'Guatemala',
  HN: 'Honduras',
  NI: 'Nicaragua',
  PA: 'Panama',
  BB: 'Barbados',
  TT: 'Trinidad and Tobago',
  JM: 'Jamaica',
  BS: 'Bahamas',
  CU: 'Cuba',
  HT: 'Haiti',
  DO: 'Dominican Republic',
  LC: 'Saint Lucia',
  VC: 'Saint Vincent and the Grenadines',
  GD: 'Grenada',
  AG: 'Antigua and Barbuda',
  DM: 'Dominica',
  KN: 'Saint Kitts and Nevis',
  AW: 'Aruba',
  CW: 'Curaçao',
  SX: 'Sint Maarten',
  BQ: 'Caribbean Netherlands',
  FK: 'Falkland Islands',
  GS: 'South Georgia and the South Sandwich Islands',
  SH: 'Saint Helena',
  GL: 'Greenland',
  FO: 'Faroe Islands',
  AX: 'Åland Islands',
  SJ: 'Svalbard and Jan Mayen',
  UM: 'U.S. Minor Outlying Islands',
  BV: 'Bouvet Island',
  HM: 'Heard Island and McDonald Islands',
  AQ: 'Antarctica',
  TF: 'French Southern Territories',
  IO: 'British Indian Ocean Territory',
  CX: 'Christmas Island',
  CC: 'Cocos (Keeling) Islands',
  NF: 'Norfolk Island',
  PN: 'Pitcairn Islands',
  GI: 'Gibraltar',
  JE: 'Jersey',
  GG: 'Guernsey',
  IM: 'Isle of Man',
  EH: 'Western Sahara',
  SS: 'South Sudan',
  ER: 'Eritrea',
  DJ: 'Djibouti',
  CG: 'Republic of the Congo',
  GA: 'Gabon',
  GQ: 'Equatorial Guinea',
  ST: 'São Tomé and Príncipe',
  SL: 'Sierra Leone',
  LR: 'Liberia',
  GM: 'Gambia',
  GW: 'Guinea-Bissau',
  GN: 'Guinea',
  CV: 'Cape Verde',
  MR: 'Mauritania',
  SD: 'Sudan',
  SY: 'Syria',
  PS: 'Palestine',
  YE: 'Yemen',
  EC: 'Ecuador',
  BO: 'Bolivia',
  PY: 'Paraguay',
  UY: 'Uruguay',
};

export function SearchableCountrySelect({ value, onChange, style }: SearchableCountrySelectProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Build country list with dial codes
  const countries = useMemo(() => {
    const allCountries = getCountries();
    return allCountries
      .map((code) => {
        try {
          const dialCode = getCountryCallingCode(code);
          const name = COUNTRY_NAMES[code] || code;
          return {
            isoCode: code,
            name,
            dialCode,
            label: `${name} (+${dialCode})`,
          };
        } catch (e) {
          return null;
        }
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  // Filter countries by search
  const filteredCountries = useMemo(() => {
    if (!search) return countries;
    const lowerSearch = search.toLowerCase();
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(lowerSearch) ||
        c.isoCode.toLowerCase().includes(lowerSearch) ||
        c.dialCode.includes(lowerSearch)
    );
  }, [countries, search]);

  // Get current selection (value is calling code like "1", "44")
  const selectedCountry = countries.find((c) => c.dialCode === value);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlighted index when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        setHighlightedIndex((prev) =>
          prev < filteredCountries.length - 1 ? prev + 1 : prev
        );
        e.preventDefault();
        break;
      case 'ArrowUp':
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        e.preventDefault();
        break;
      case 'Enter':
        if (filteredCountries[highlightedIndex]) {
          onChange(filteredCountries[highlightedIndex].dialCode);
          setIsOpen(false);
          setSearch('');
        }
        e.preventDefault();
        break;
      case 'Escape':
        setIsOpen(false);
        setSearch('');
        e.preventDefault();
        break;
    }
  };

  const handleSelect = (dialCode: string) => {
    onChange(dialCode);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div style={{ position: 'relative', ...style }}>
      <input
        ref={inputRef}
        type="text"
        value={isOpen ? search : selectedCountry?.label || ''}
        onChange={(e) => {
          setSearch(e.target.value);
          if (!isOpen) setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search countries..."
        style={{
          width: '100%',
          padding: '6px 8px',
          fontSize: 11,
          border: `1px solid ${C.border2}`,
          borderRadius: 0,
          background: C.bg,
          color: C.text,
          fontFamily: F.sans,
        }}
      />

      {isOpen && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 2,
            maxHeight: 240,
            overflowY: 'auto',
            background: C.surface,
            border: `1px solid ${C.border2}`,
            borderRadius: 0,
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {filteredCountries.length === 0 ? (
            <div
              style={{
                padding: 8,
                fontSize: 11,
                color: C.text3,
                textAlign: 'center',
              }}
            >
              No countries found
            </div>
          ) : (
            filteredCountries.map((country, index) => (
              <div
                key={country.isoCode}
                onClick={() => handleSelect(country.dialCode)}
                style={{
                  padding: '6px 8px',
                  fontSize: 11,
                  color: C.text,
                  background:
                    index === highlightedIndex
                      ? C.hover
                      : country.dialCode === value
                      ? C.indigoDim
                      : 'transparent',
                  cursor: 'pointer',
                  borderLeft:
                    country.dialCode === value
                      ? `2px solid ${C.indigo}`
                      : '2px solid transparent',
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                {country.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
