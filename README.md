# Until

A catalog of future dates — public holidays from nearly every country, scheduled events from Wikipedia and Wikidata, plus curated milestones (eclipses, World Cups, Olympics, elections). Each date is tagged, classified, and shown as a live countdown.

## What you can do

- Browse thousands of upcoming dates
- Filter by category (holidays, sports, astronomy, space, tech, politics, …)
- Search titles, tags, and countries
- Open a full-page ticking countdown
- Add any date to Google Calendar, Outlook, or download an `.ics`
- Create personal countdowns (stored in the browser, shareable via URL)

## Catalog

Regenerate the database:

```bash
npm run seed
```

The seed script:

1. Pulls worldwide public holidays from [Nager.Date](https://date.nager.at/) for 2026–2032
2. Merges the same holiday on the same day across countries (one Christmas, many regions)
3. Adds recurring astronomy and culture dates
4. Adds a curated set of notable future events
5. Best-effort scrape of Wikipedia year pages and a Wikidata SPARQL query
6. Auto-tags and classifies every row
7. Writes `src/data/events.json` and `src/data/countries.json`

## Develop

```bash
npm install
npm run seed   # first time, or when you want a fresh catalog
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stack

Next.js (App Router) · TypeScript · Tailwind v4 · no backend required for v1
