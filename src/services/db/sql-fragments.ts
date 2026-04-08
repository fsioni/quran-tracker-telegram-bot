import { KAHF_FIRST_PAGE_WEIGHT, KAHF_PAGE_START } from "../../data/pages";

export const KAHF_PAGE_ADJ = 1 - KAHF_FIRST_PAGE_WEIGHT;
export const KAHF_PAGE_ADJ_SQL = `CASE WHEN type = 'kahf' AND page_start = ${KAHF_PAGE_START} THEN ${KAHF_PAGE_ADJ} ELSE 0.0 END`;
export const ADJ_PAGE_COUNT_SQL = `page_end - page_start + 1 - (${KAHF_PAGE_ADJ_SQL})`;

export const HAS_SPEED_DATA_SQL =
  "page_start IS NOT NULL AND page_end IS NOT NULL AND duration_seconds IS NOT NULL";

export const PAGE_STATS_SQL = `COALESCE(SUM(CASE WHEN page_start IS NOT NULL AND page_end IS NOT NULL THEN ${ADJ_PAGE_COUNT_SQL} ELSE 0 END), 0)`;
export const PAGE_SECONDS_SQL = `COALESCE(SUM(CASE WHEN ${HAS_SPEED_DATA_SQL} THEN duration_seconds ELSE 0 END), 0)`;
