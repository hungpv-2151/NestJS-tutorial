import { randomUUID } from 'node:crypto';

const MAX_SLUG_BASE_LENGTH = 80;
const NON_ASCII_WORDS = /[^a-z0-9]+/g;
const COMBINING_MARKS = /\p{M}/gu;

export function createArticleSlug(
  title: string,
  createId: () => string = randomUUID,
): string {
  const base = title
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(NON_ASCII_WORDS, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_BASE_LENGTH)
    .replace(/-+$/g, '');

  return `${base || 'article'}-${createId()}`;
}
