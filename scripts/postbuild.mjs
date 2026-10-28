import { writeFileSync } from 'node:fs';
writeFileSync(new URL('../.next/export-base-path', import.meta.url), (process.env.STORY_BASE_PATH ?? '').replace(/\/$/, ''));
