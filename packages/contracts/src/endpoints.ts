// Endpoint map: GET only; an error is `ApiErrorBody`.

import { z } from 'zod';
import { EventsQuery, EventsStatsQuery, OverviewQuery, SeriesQuery } from './query.ts';
import { EventsPage, EventsStats, Health, Overview, Series } from './schemas.ts';

export const endpoints = {
  overview: { path: '/v1/supply/overview', query: OverviewQuery, response: Overview },
  series: { path: '/v1/supply/series', query: SeriesQuery, response: Series },
  events: { path: '/v1/supply/events', query: EventsQuery, response: EventsPage },
  eventsStats: { path: '/v1/supply/events/stats', query: EventsStatsQuery, response: EventsStats },
  health: { path: '/health', query: z.object({}), response: Health }, // 200 when the DB is available, else 503
} as const;
