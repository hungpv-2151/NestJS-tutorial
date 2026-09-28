import { In, type EntityManager } from 'typeorm';

import { Tag } from '../tags/tag.entity.js';
import { ArticleTag } from './article-tag.entity.js';

export class ArticleTagPersistenceError extends Error {}

export function uniqueArticleTagNames(names: readonly string[]): string[] {
  return [...new Set(names)];
}

export async function persistArticleTags(
  manager: EntityManager,
  articleId: string,
  names: readonly string[],
): Promise<string[]> {
  const uniqueNames = uniqueArticleTagNames(names);
  const tagIds = await ensureTagsExist(manager, uniqueNames);
  await insertArticleTagLinks(manager, articleId, uniqueNames, tagIds);
  return uniqueNames;
}

export async function replaceArticleTags(
  manager: EntityManager,
  articleId: string,
  names: readonly string[],
): Promise<string[]> {
  const uniqueNames = uniqueArticleTagNames(names);
  const tagIds = await ensureTagsExist(manager, uniqueNames);
  await manager.getRepository(ArticleTag).delete({ articleId });
  await insertArticleTagLinks(manager, articleId, uniqueNames, tagIds);
  return uniqueNames;
}

async function insertArticleTagLinks(
  manager: EntityManager,
  articleId: string,
  names: readonly string[],
  tagIds: Map<string, string>,
): Promise<void> {
  if (names.length === 0) return;

  await manager.getRepository(ArticleTag).insert(
    names.map((name, position) => ({
      articleId,
      position,
      tagId: tagIds.get(name)!,
    })),
  );
}

async function ensureTagsExist(
  manager: EntityManager,
  names: readonly string[],
): Promise<Map<string, string>> {
  if (names.length === 0) return new Map();

  await manager
    .getRepository(Tag)
    .createQueryBuilder()
    .insert()
    .values(names.map((name) => ({ name })))
    .orIgnore()
    .execute();

  const storedTags = await manager.getRepository(Tag).findBy({
    name: In([...names]),
  });
  const tagIds = new Map(storedTags.map(({ name, id }) => [name, id]));
  for (const name of names) {
    if (!tagIds.has(name)) {
      throw new ArticleTagPersistenceError(
        'tag insert did not return a persisted row',
      );
    }
  }
  return tagIds;
}
