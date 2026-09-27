import type { User } from '../users/user.entity.js';

export interface ArticleSerializationContext {
  tags: string[];
  favorited: boolean;
  favoritesCount: number;
  authorFollowing: boolean;
}

export interface ArticleSerializationInput {
  slug: string;
  title: string;
  description: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  author: User;
  context: ArticleSerializationContext;
}

type ArticleFields = Omit<
  ArticleSerializationInput,
  'author' | 'context' | 'body' | 'createdAt' | 'updatedAt'
> & {
  createdAt: string;
  updatedAt: string;
  tagList: string[];
  favorited: boolean;
  favoritesCount: number;
  author: {
    username: string;
    bio: string | null;
    image: string | null;
    following: boolean;
  };
};

export function serializeArticleDetail(article: ArticleSerializationInput) {
  return { article: { ...toArticleFields(article), body: article.body } };
}

export function serializeArticleList(
  articles: ArticleSerializationInput[],
  articlesCount: number,
) {
  return {
    articles: articles.map(toArticleFields),
    articlesCount,
  };
}

function toArticleFields(article: ArticleSerializationInput): ArticleFields {
  return {
    slug: article.slug,
    title: article.title,
    description: article.description,
    tagList: [...article.context.tags],
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
    favorited: article.context.favorited,
    favoritesCount: Math.max(0, article.context.favoritesCount),
    author: {
      username: article.author.username,
      bio: article.author.bio,
      image: article.author.image,
      following: article.context.authorFollowing,
    },
  };
}
