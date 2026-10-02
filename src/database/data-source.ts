import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { getDatabaseConfig } from '../config/database-config.js';
import { User } from '../users/user.entity.js';
import { WelcomeMailOutbox } from '../jobs/welcome-mail-outbox.entity.js';
import { UserFollow } from '../profiles/user-follow.entity.js';
import { Attachment } from '../attachments/attachment.entity.js';
import { Article } from '../articles/article.entity.js';
import { ArticleTag } from '../articles/article-tag.entity.js';
import { ArticleFavorite } from '../articles/article-favorite.entity.js';
import { Tag } from '../tags/tag.entity.js';
import { Comment } from '../comments/comment.entity.js';
import { CreateUsers1710000000000 } from './migrations/1710000000000-create-users.js';
import { CreateWelcomeMailOutbox1710000001000 } from './migrations/1710000001000-create-welcome-mail-outbox.js';
import { CreateUserFollows1710000002000 } from './migrations/1710000002000-create-user-follows.js';
import { CreateAttachments1710000003000 } from './migrations/1710000003000-create-attachments.js';
import { CreateArticlesTagsFavorites1710000004000 } from './migrations/1710000004000-create-articles-tags-favorites.js';
import { CreateComments1710000005000 } from './migrations/1710000005000-create-comments.js';

export const dataSourceOptions = {
  type: 'postgres' as const,
  url: getDatabaseConfig().url,
  entities: [
    User,
    WelcomeMailOutbox,
    UserFollow,
    Attachment,
    Article,
    ArticleTag,
    ArticleFavorite,
    Tag,
    Comment,
  ],
  migrations: [
    CreateUsers1710000000000,
    CreateWelcomeMailOutbox1710000001000,
    CreateUserFollows1710000002000,
    CreateAttachments1710000003000,
    CreateArticlesTagsFavorites1710000004000,
    CreateComments1710000005000,
  ],
  synchronize: false,
};

export default new DataSource(dataSourceOptions);
