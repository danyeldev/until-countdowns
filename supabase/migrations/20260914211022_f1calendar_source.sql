-- F1Calendar publishes small, MIT-licensed season files without an API key.
-- Rank 6 gives published session instants precedence over the Wikimedia feeds,
-- while preserving reviewed curated dates (rank 9). This migration changes only
-- source metadata; ingestion is run separately after deployment.
insert into public.sources (id, label, rank, homepage, license, attribution) values
  ('f1calendar', 'F1Calendar', 6, 'https://f1calendar.com', 'MIT',
   'Formula 1 schedule data from F1Calendar (sportstimes/f1). Copyright (c) 2021 Andrew Yates, Si Jobling, Andy Higgs. MIT License: https://github.com/sportstimes/f1/blob/main/LICENSE')
on conflict (id) do update set
  label = excluded.label,
  rank = excluded.rank,
  homepage = excluded.homepage,
  license = excluded.license,
  attribution = excluded.attribution;
