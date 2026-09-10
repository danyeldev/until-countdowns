-- Give the UFC a start time.
--
-- A fight card reaches the catalog through `wikipedia-categories`, which resolves each card to a
-- Wikidata date. Wikidata states those to day precision and nothing finer, so every UFC row is an
-- all-day row: the page says "UFC 320 is on 4 October" and the countdown runs to midnight, hours
-- after the main event has been decided. ESPN's public MMA scoreboard states the same cards to the
-- minute, and `espn` (src/lib/ingest/sources/espn.ts) is the adapter that reads it.
--
-- The rank is the whole point of this row. Merge precedence is a strict '>' (`public.source_rank`,
-- 0001_core.sql), so ESPN at 6 beats `wikipedia-categories` at 3 and its instant replaces the
-- all-day date on a card both sources describe — which is the fix. 6 puts it alongside
-- `football-data`, the other fixture feed carrying real kick-offs, and keeps it under `curated` (9):
-- a hand-checked date still wins, as it must.
--
-- Licence: none, and the null is meant. A schedule is a set of facts and facts are not
-- copyrightable, so there is no licence for ESPN to grant us and none to comply with. What ESPN's
-- terms of use do say is that scripted access to the site is not permitted — a contract question,
-- not a copyright one. The project has weighed that and accepted the risk deliberately for schedule
-- data (README, "Licence policy"); the `Rejected alternatives` note in football-data.ts records the
-- same terms and is kept as a note, not a veto. The endpoint is public and unkeyed and the cron
-- calls it once a day. Attribution is not owed and is stored anyway, because every event page names
-- where its date came from.

insert into public.sources (id, label, rank, homepage, license, attribution) values
 ('espn','ESPN',6,'https://www.espn.com/mma/',null,'Schedule data from ESPN')
on conflict (id) do update set label = excluded.label, rank = excluded.rank, homepage = excluded.homepage, license = excluded.license, attribution = excluded.attribution;
