<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## API bootstrap

Install dependencies, set `DATABASE_URL` to a PostgreSQL connection URL, and
start the local server:

```bash
pnpm install
pnpm start:dev
```

The start scripts load the local, ignored `.env` file when it exists. The
service connects to PostgreSQL during startup; it does not start when
`DATABASE_URL` is absent or invalid. Copy the safe placeholders in
`.env.example` into your local `.env` file. Never commit connection strings or
credentials.

The service listens on `http://localhost:3000` by default. Set overrides in
the process environment used to start the service:

| Variable | Default | Valid values and behavior |
| --- | --- | --- |
| `PORT` | `3000` | Integer from `1` to `65535`. |
| `BODY_LIMIT` | `100kb` | Positive integer followed by `kb` or `mb`, such as `2mb`. |
| `NODE_ENV` | unset | Set to `production` to apply production Swagger behavior. |
| `SWAGGER_ENABLED` | unset | Set to the exact value `true` to enable Swagger in production. |
| `DATABASE_URL` | required | PostgreSQL connection URL used by the application at startup. |
| `TEST_DATABASE_URL` | required for tests | PostgreSQL connection URL used only by the test runners. |

`pnpm test` and `pnpm test:e2e` require `TEST_DATABASE_URL` and use it as
their database connection.

## Database migrations

Set `DATABASE_URL` to the target PostgreSQL database before running a
migration. Keep the connection string in a local ignored environment file; do
not commit credentials.

```bash
# Apply pending migrations
pnpm db:migration:apply

# Show applied and pending migrations
pnpm db:migration:show

# Revert the most recently applied migration
pnpm db:migration:revert

# Drop and recreate the test database from all migrations
CONFIRM_DATABASE_RESET=yes pnpm db:migration:reset
```

Each command builds the project before invoking TypeORM. Reverting the users
migration drops the `users` table, so use it only when that data can be lost.

`pnpm db:migration:reset` is destructive: it drops the database at
`TEST_DATABASE_URL` and reruns every migration. Set `TEST_DATABASE_URL` to the
intended PostgreSQL test database and pass the exact confirmation value
`CONFIRM_DATABASE_RESET=yes`; the command fails without either value.

`GET /api/hello` returns a localized greeting. `Accept-Language: vi` and
`vi-*` values select Vietnamese; a missing, English, or unsupported locale
uses English.

```json
{ "message": "Hello!", "locale": "en" }
```

For example, request Vietnamese with:

```bash
curl --header 'Accept-Language: vi-VN,vi;q=0.9' http://localhost:3000/api/hello
```

```json
{ "message": "Xin chào!", "locale": "vi" }
```

Swagger UI is available at `http://localhost:3000/docs`, with its OpenAPI JSON
at `http://localhost:3000/docs-json`. Both routes are enabled outside
production. When `NODE_ENV=production`, both return `404` unless
`SWAGGER_ENABLED=true` is set explicitly.

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

This project does not currently configure an observability provider. Before production, choose and configure one appropriate to your environment. [NestJS Observe](https://observe.nestjs.com) is one option for automatic instrumentation:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
