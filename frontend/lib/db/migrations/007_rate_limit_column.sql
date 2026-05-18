-- Migration: Add rate_limit_per_10s to hubspot_connections
-- Stores the observed HubSpot rate limit for each connection.
-- Populated on first API call from X-HubSpot-RateLimit-Max header.

alter table hubspot_connections
  add column if not exists rate_limit_per_10s integer;

comment on column hubspot_connections.rate_limit_per_10s is
  'Burst rate limit per 10 seconds, observed from X-HubSpot-RateLimit-Max header';
