/**
 * Auto-translates missing dimension values in the "translations" datasource.
 * Fills gaps in German (de) dimension using the free MyMemory translation API.
 *
 * This helps when you have UI strings that need translation but don't want to
 * manually translate each one. The script provides a rough first-pass translation
 * that editors can review and refine.
 *
 * Usage:
 *   node scripts/storyblok-autotranslate-datasource.mjs [--force]
 *
 * Options:
 *   --force   Re-translate all entries, even those already translated (careful!)
 *
 * Required in .env.local:
 *   STORYBLOK_PERSONAL_MANAGEMENT_TOKEN
 *   STORYBLOK_SPACE_ID
 *
 * Rate limits:
 *   MyMemory API: 500 requests/day without API key
 *   This script sleeps 1 second between translations to be safe
 */

import { loadEnv, createApi, log } from "./storyblok-helper.mjs"

const FORCE_RETRANSLATE = process.argv.includes("--force")

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Translate text from English to German using MyMemory API.
 * Falls back to original text if translation fails.
 */
const translateEnToDE = async (text) => {
  if (!text || typeof text !== "string") return text

  try {
    const encoded = encodeURIComponent(text)
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encoded}&langpair=en|de`,
      { headers: { "User-Agent": "storyblok-scripts/1.0" } }
    )
    const json = await res.json()

    if (json.responseData?.translatedText) {
      return json.responseData.translatedText
    }
  } catch (err) {
    console.error(`  Translation failed for "${text}":`, err.message)
  }

  return text // Fallback to original
}

const run = async () => {
  const { token, spaceId } = loadEnv()
  const api = createApi({ token, spaceId })

  log("📡", "Fetching datasources...")
  const { data: dsRes } = await api.get("/datasources")
  const datasources = dsRes.datasources ?? []

  const translations = datasources.find((ds) => ds.slug === "translations")
  if (!translations) {
    log("❌", 'Datasource "translations" not found')
    return
  }
  log("✅", `Found datasource: ${translations.name}`)

  log("📡", "Fetching dimensions...")
  // Dimensions are returned as part of the datasource, not a separate endpoint
  const dimensions = translations.dimensions ?? []

  const deDimension = dimensions.find((d) => d.entry_value === "de" || d.value === "de")
  if (!deDimension) {
    log("❌", 'German "de" dimension not found')
    log("💡", "Create it manually in Storyblok: Datasources > Translations > Config > Dimensions")
    return
  }
  log("✅", `Found German dimension: ${deDimension.name}`)

  log("📡", "Fetching entries...")
  const { data: entriesRes } = await api.get(
    `/datasource_entries?datasource_id=${translations.id}&per_page=1000`
  )
  const entries = entriesRes.datasource_entries ?? []

  // Build a map of existing German translations
  // Note: German translations are stored in the 'value' field when querying with dimension_id
  const deByName = new Map()
  entries.forEach((e) => {
    if (e.value) {
      deByName.set(e.name, e.value)
    }
  })

  // Filter to only entries without German translation (or --force to retranslate all)
  const baseEntries = FORCE_RETRANSLATE
    ? entries
    : entries.filter(e => !deByName.has(e.name))

  log("", "")
  log("🔄", `Processing ${baseEntries.length} entries...`)

  let translated = 0
  let skipped = 0

  for (const entry of baseEntries) {
    const existing = deByName.get(entry.name)

    if (!FORCE_RETRANSLATE && existing) {
      log("⏭", `${entry.name} — already translated (${existing})`)
      skipped++
      continue
    }

    log("🌐", `Translating "${entry.name}": "${entry.value}"...`)
    const de = await translateEnToDE(entry.value)

    const { status } = await api.put(
      `/datasource_entries/${entry.id}?dimension_id=${deDimension.id}`,
      {
        datasource_entry: {
          value: de,
          dimension_value: de,
          datasource_id: translations.id,
        },
      }
    )

    if (status === 200 || status === 204) {
      log("✅", `${entry.name} → "${de}"`)
      translated++
    } else {
      log("❌", `${entry.name} failed (status ${status})`)
    }

    await sleep(1000)
  }

  log("", "")
  log("📊", `Translated: ${translated}, Skipped: ${skipped}`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
