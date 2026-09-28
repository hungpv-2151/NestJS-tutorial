# Project Changelog

## 2026-09-28

- Completed the Phase 4A article, tag, and favorite schema foundation and shared serializers in commit `c2910ec26314a26c70b818ca29963f1625ca5bc3` ([PR #47](https://github.com/hungpv-2151/NestJS-tutorial/pull/47), ready for review on #46). Build passed; focused Vitest passed (3 files / 6 tests); `pnpm test` passed (32 files; 129 passed / 1 skipped); lint passed with 0 errors and 158 warnings across 103 source files. Disposable PostgreSQL 16 apply/revert/apply passed, with existing tables and migration records preserved, 4A tables restored, uniqueness/position constraints and cascade behavior verified, and unused tags retained. [Validation correction](https://github.com/hungpv-2151/NestJS-tutorial/pull/47#issuecomment-5861324933) · [database evidence](https://github.com/hungpv-2151/NestJS-tutorial/pull/47#issuecomment-5861307909).
