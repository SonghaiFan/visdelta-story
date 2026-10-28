import { mkdirSync, readFileSync, writeFileSync, cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
mkdirSync(new URL('../public/data/', import.meta.url), { recursive: true });
cpSync(new URL('../data/weather/', import.meta.url), new URL('../public/data/weather/', import.meta.url), { recursive: true });
cpSync(new URL('../docs/authoring.mdx', import.meta.url), new URL('../public/authoring.mdx', import.meta.url));
// Live MDX uses the installed Tailwind compiler/theme, served locally with its license.
const tailwindDirectory = fileURLToPath(new URL('../node_modules/tailwindcss/', import.meta.url));
const storyStyleDirectory = fileURLToPath(new URL('../public/data/story/', import.meta.url));
mkdirSync(storyStyleDirectory, { recursive: true });
const appStyles = readFileSync(new URL('../app/global.css', import.meta.url), 'utf8');
const referenceTheme = [...appStyles.matchAll(/@theme(?:\s+static)?\s*\{([\s\S]*?)\n\}/g)].map(match => match[1]).join('\n');
const theme = readFileSync(`${tailwindDirectory}theme.css`, 'utf8');
const license = readFileSync(`${tailwindDirectory}LICENSE`, 'utf8');
writeFileSync(`${storyStyleDirectory}tailwind.css`, `/*! ${license} */\n${theme}\n@theme reference {${referenceTheme}\n}\n@custom-variant dark (&:where(.dark, .dark *));\n.story-document { @tailwind utilities; }\n`);
