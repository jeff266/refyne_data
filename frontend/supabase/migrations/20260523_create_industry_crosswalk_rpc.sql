-- Industry Crosswalk RPC for Harmony System
-- Looks up HubSpot enum value from provider industry values

create or replace function lookup_industry_crosswalk(
  p_input_value text,
  p_naics_code text default null,
  p_provider text default null
)
returns table (
  matched boolean,
  output text,
  naics_code text,
  naics_label text
)
language plpgsql
stable
as $$
declare
  v_hubspot_value text;
  v_naics_code text;
  v_naics_label text;
begin
  -- Strategy 1: Exact NAICS code match (most reliable)
  if p_naics_code is not null and p_naics_code != '' then
    select
      hubspot_value,
      naics_code,
      naics_label
    into
      v_hubspot_value,
      v_naics_code,
      v_naics_label
    from industry_crosswalk
    where naics_code = p_naics_code
    limit 1;

    if v_hubspot_value is not null then
      return query select true, v_hubspot_value, v_naics_code, v_naics_label;
      return;
    end if;
  end if;

  -- Strategy 2: NAICS label match (case-insensitive)
  select
    hubspot_value,
    naics_code,
    naics_label
  into
    v_hubspot_value,
    v_naics_code,
    v_naics_label
  from industry_crosswalk
  where lower(naics_label) = lower(p_input_value)
  limit 1;

  if v_hubspot_value is not null then
    return query select true, v_hubspot_value, v_naics_code, v_naics_label;
    return;
  end if;

  -- Strategy 3: Provider-specific label match
  if p_provider = 'apollo' then
    select
      hubspot_value,
      naics_code,
      naics_label
    into
      v_hubspot_value,
      v_naics_code,
      v_naics_label
    from industry_crosswalk
    where lower(apollo_label) = lower(p_input_value)
    limit 1;

    if v_hubspot_value is not null then
      return query select true, v_hubspot_value, v_naics_code, v_naics_label;
      return;
    end if;
  elsif p_provider = 'linkedin' then
    select
      hubspot_value,
      naics_code,
      naics_label
    into
      v_hubspot_value,
      v_naics_code,
      v_naics_label
    from industry_crosswalk
    where lower(linkedin_value) = lower(p_input_value)
    limit 1;

    if v_hubspot_value is not null then
      return query select true, v_hubspot_value, v_naics_code, v_naics_label;
      return;
    end if;
  end if;

  -- No match found
  return query select false, null::text, p_naics_code, p_input_value;
end;
$$;

-- Add comment
comment on function lookup_industry_crosswalk is 'Looks up HubSpot industry enum value from provider industry labels using NAICS crosswalk table';
