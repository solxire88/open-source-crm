-- Extensions
create extension if not exists pgcrypto;
create extension if not exists citext;

-- Enums
create type public.lead_stage as enum (
  'New',
  'Contacted',
  'Replied',
  'Meeting',
  'Proposal',
  'Won',
  'Lost'
);

create type public.access_level as enum ('read', 'edit');

create type public.app_role as enum ('admin', 'sales');

create type public.followup_window as enum ('Morning', 'Afternoon', 'Anytime');

create type public.theme_preference as enum ('light', 'dark', 'system');

create type public.source_type as enum (
  'Instagram',
  'Meta Ads',
  'Scraping',
  'Referral',
  'Website',
  'Other',
  'Unknown'
);
