# Agent Guidelines

## Commands

- **Build**: `npm run build` (runs `tsc`)
- **Test**: `npm run test` (runs `vitest`). Single test: `npx vitest test/unit/parsers.test.ts`
- **Lint**: `npm run lint` (eslint)
- **Format**: `npm run format` (prettier)

## Code Style

- **Imports**: Use ES modules with explicit `.js` extensions for local imports (e.g., `import { x } from './utils.js'`).
- **Formatting**: Follow Prettier defaults. 2 spaces indent. Semicolons required.
- **Naming**: camelCase for functions/vars, PascalCase for types/classes.
- **Types**: strict TypeScript. Avoid `any`. Use `zod` for validation.
- **Error Handling**: Use `try/catch`. Return standard error responses using helpers in `src/lib/utils.ts`.
- **Conventions**:
  - `src/routes/` for Astro API endpoints (export `GET`, `POST`, etc.).
  - `src/validators/` for input validation logic.
