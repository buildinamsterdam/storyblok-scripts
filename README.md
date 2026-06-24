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

API methods: `get(path)`, `post(path, body)`, `put(path, body)`, `del(path)`

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
