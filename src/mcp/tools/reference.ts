import { z } from "zod";
import { getJuzEndPage, JUZ_START_PAGES } from "../../data/juz";
import { SURAHS } from "../../data/surahs";
import { schemaMarkdown } from "../resources/schema-text";

const H2_SPLIT_RE = /\n## /;

export const GetSurahsParams = z.object({
  ids: z.array(z.number().int().min(1).max(114)).optional(),
});

export function getSurahsTool(input: {
  params: z.infer<typeof GetSurahsParams>;
}) {
  const all = SURAHS.map((s) => ({
    id: s.number,
    name: s.name,
    arabic_name: s.nameAr,
    ayah_count: s.ayahCount,
  }));
  if (!input.params.ids || input.params.ids.length === 0) {
    return all;
  }
  const set = new Set(input.params.ids);
  return all.filter((s) => set.has(s.id));
}

export const GetJuzPagesParams = z.object({
  juz: z.number().int().min(1).max(30).optional(),
});

const ALL_JUZ = JUZ_START_PAGES.map((startPage, i) => ({
  juz: i + 1,
  pageStart: startPage,
  pageEnd: getJuzEndPage(i + 1),
}));

export function getJuzPagesTool(input: {
  params: z.infer<typeof GetJuzPagesParams>;
}) {
  if (input.params.juz === undefined) {
    return ALL_JUZ;
  }
  return ALL_JUZ.filter((j) => j.juz === input.params.juz);
}

export const GetSchemaParams = z.object({
  table: z.string().optional(),
});

export function getSchemaTool(input: {
  params: z.infer<typeof GetSchemaParams>;
}) {
  const table = input.params.table;
  if (!table) {
    return schemaMarkdown;
  }
  // Naive section extraction by H2 headings
  const sections = schemaMarkdown.split(H2_SPLIT_RE);
  const match = sections.find((s) =>
    s.toLowerCase().startsWith(table.toLowerCase())
  );
  return match ? `## ${match}` : schemaMarkdown;
}
