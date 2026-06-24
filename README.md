# Storyblok Scripts

Reusable Node.js scripts for managing Storyblok spaces. Automate translation setup, component configuration, and datasource management — no npm install needed.

## Requirements

- **Node.js** ≥ 18
- **Storyblok workspace** with Management API access
- **.env.local** with two environment variables

## Usage & context
These scripts were set up during the work on the [Front Row website](https://github.com/buildinamsterdam/front-row-platform). They reduced a lot of manual work. You can use these scripts, but also use them as inspiration to see how you can adapt it to your projects.

I would recommend that experiment and try these out during development and new stores. It's easy to overwrite content and reset your progress. 

## Setup

1. Copy `.env.example` → `.env.local`
2. Fill in your Storyblok credentials:
   - `STORYBLOK_PERSONAL_MANAGEMENT_TOKEN` — get this from Settings > Access Tokens > Create Token (select "Full access")
   - `STORYBLOK_SPACE_ID` — find it in the URL `app.storyblok.com/f/[SPACE_ID]`

3. Run a script:
   ```sh
   node scripts/storyblok-make-fields-translatable.mjs
   ```

## Scripts

### `storyblok-make-fields-translatable.mjs`

**When to use:** You're scaffolding a new Storyblok space or enabling a second language. Every field across every content type needs its "Translatable" toggle switched on. Doing this manually in the UI is tedious and is error-prone. This script does it in seconds.

**What it does:**
- Fetches all components (blocks, elements, entities)
- For each field (except container `bloks` fields), sets `translatable: true`
- Updates the component schema via the Management API

**Usage:**
```sh
node scripts/storyblok-make-fields-translatable.mjs
```

**Output:**
```
📡  Fetching all components...
📦  Found 87 components
✅  block_cta — 2 fields marked translatable
...
📊  Updated: 80, Skipped: 7
```

---

### `storyblok-autotranslate-datasource.mjs`

**When to use:** After enabling translations, UI string datasources (like button labels, form placeholders) still need values for each language. Translating these manually is takes a lot of time, and clients may not have the resources. This script auto-fills missing dimension values using the free MyMemory API, giving the client a rough first-pass translation to review and refine.

**What it does:**
- Finds the `translations` datasource and the German (`de`) dimension
- Compares base English entries with existing German translations
- For missing translations, calls the free MyMemory API to translate EN → DE
- Updates each missing dimension value, respecting existing translations

> this script translates English to German as an example, you can adjust to translate other languages

**Usage:**
```sh
# Translate only missing entries (gaps)
node scripts/storyblok-autotranslate-datasource.mjs

# Re-translate everything (useful if quality is poor)
node scripts/storyblok-autotranslate-datasource.mjs --force
```

**Output:**
```
📡  Fetching datasources...
✅  Found datasource: Translations
✅  Found German dimension: Deutsch
🌐  Translating "Search"...
✅  search → "Suchen"
...
📊  Translated: 5, Skipped: 2
```

**Rate limiting:** MyMemory free tier is 500 requests/day without an API key. The script sleeps 1 second between translations to stay safe.

---

### `storyblok-unused-assets.mjs`

**When to use:** Your Storyblok space is approaching its asset storage limit, you want to audit what's been uploaded but never used, or you're doing a general clean-up before handing a space over to a client.

**What it does:**
- Fetches all stories and stringifies their content for URL matching
- Fetches all assets (optionally scoped to a specific folder via `--folder-id`)
- Flags any asset whose CDN path doesn't appear anywhere in story content as unused
- Reports unused count and total reclaimable storage in MB
- Default: **dry run** — lists unused assets without touching anything
- With `--delete`: permanently removes unused assets from the space

> ⚠️ Assets referenced outside Storyblok — hardcoded in code, CSS, emails, or external tools — will appear as unused. Always review the list before running `--delete`.

**Usage:**
```sh
# Dry run — list unused assets and how much space they take
node scripts/storyblok-unused-assets.mjs

# Scope to a specific asset folder (find folder ID in the Storyblok UI URL)
node scripts/storyblok-unused-assets.mjs --folder-id=123456

# Actually delete unused assets
node scripts/storyblok-unused-assets.mjs --delete

# Scope + delete
node scripts/storyblok-unused-assets.mjs --folder-id=123456 --delete
```

**Output:**
```
📖  Fetching all stories...
⏳  Fetching full content for 84 stories...
✅  Loaded 84 stories
🖼️   Fetching assets...
✅  Found 312 assets

📊  Results: 47 unused of 312 total assets
💾  Reclaimable storage: 214.3 MB

  🗂️   hero-old-v2.jpg (4.2 MB)
  🗂️   test-upload.png (0.1 MB)
  ...

ℹ️   Dry run — run with --delete to permanently remove these assets
⚠️   Review the list first: assets used outside Storyblok will appear here too
```

**Performance note:** For large spaces (100+ stories), fetching full story content takes a few minutes due to rate-limit delays. This is a one-off maintenance task.

---

## Using in Your Project

Copy the `scripts/` folder into your project root:
```sh
cp -r storyblok-scripts/scripts ./
cp storyblok-scripts/.env.example ./
mv .env.example .env.local
# Fill in .env.local with your credentials
node scripts/storyblok-make-fields-translatable.mjs
```

Or cherry-pick individual scripts and the helper:
```sh
cp storyblok-scripts/scripts/storyblok-helper.mjs ./scripts/
cp storyblok-scripts/scripts/storyblok-make-fields-translatable.mjs ./scripts/
```

---

## Adding New Scripts

Use `storyblok-helper.mjs` as a base. It exports three utilities:

```js
import { loadEnv, createApi, log } from "./storyblok-helper.mjs"

const run = async () => {
  const { token, spaceId } = loadEnv()           // Parse .env.local
  const api = createApi({ token, spaceId })      // Create API client

  log("✅", "Starting script...")

  const { status, data } = await api.get("/components")
  // ↑ status: HTTP status, data: JSON response

  const updated = await api.put("/components/123", {
    component: { name: "foo", schema: {} }
  })
}

run().catch(err => { console.error(err); process.exit(1) })
```

API methods: `get(path)`, `getAll(path, params?)`, `post(path, body)`, `put(path, body)`, `del(path)`

`getAll` automatically paginates through all results (100 per page) and returns a flat array — useful when the full list exceeds a single page.

Each returns `{ status, data }` and automatically:
- Sleeps 300ms before the request (rate-limit safety)
- Adds `Authorization` + `Content-Type: application/json` headers
- Parses the JSON response (or returns `{}` if parsing fails)

### Example: Creating Content Types

See `scripts/example-create-content-type.mjs` for a complete example that shows:
- How to check for existing components
- How to define a component schema with different field types
- How to create components via POST request
- How to handle errors and idempotency

Key schema field types:
- `text` — plain text input
- `richtext` — formatted text with links, images
- `asset` — images, videos, files
- `boolean` — yes/no toggle
- `option` — single-select dropdown
- `bloks` — nested child components
- `multilink` — links to pages, emails, or external URLs

---

## Roadmap

**CMS Guide Generation** — A script that inspects your Storyblok space schema (components, fields, field types) and generates Markdown documentation automatically. The output includes:
- Each component's purpose and where it's used
- Every field with its type, helptext, and requirements (translatable, required, min/max length)
- Examples of valid field values
- Usage notes for content editors (this field expects ISO dates, this array field is sortable, etc.)

The guide can be:
- Stored as static docs in your project repo (checked into git for versioning)
- Kept up-to-date by running the script each sprint
- Shared with non-technical stakeholders (clients, content teams) to onboard them on your CMS structure

This reduces onboarding time and prevents mistakes caused by misunderstanding field types or expectations.

---

## Troubleshooting

**"Missing STORYBLOK_PERSONAL_MANAGEMENT_TOKEN"**
- Check that `.env.local` exists and contains the right token
- Tokens are personal and space-specific — if it doesn't work, regenerate in Storyblok

**"No components found"**
- Verify your space ID is correct (check the URL)
- Confirm your token has "Full access" permissions

**"German 'de' dimension not found"** (autotranslate datasource)
- The `translations` datasource exists, but the `de` dimension hasn't been created
- Create it manually: Storyblok UI → Datasources → Translations → Config → Dimensions → Add "de"

---

## License

Built in Amsterdam — internal use.
