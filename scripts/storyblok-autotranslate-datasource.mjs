/**
 * Auto-translates EMPTY dimension values in the "translations" datasource.
 * Fills gaps in German (de) dimension using the free MyMemory translation API.
 *
 * SAFETY: This script ONLY fills empty fields. It NEVER overwrites existing values,
 * even if they appear incorrect. This prevents data loss and manual fixes from being
 * overwritten.
 *
 * This helps when you have UI strings that need translation but don't want to
 * manually translate each one. The script provides a rough first-pass translation
 * that editors can review and refine.
 *
 * Usage:
 *   node scripts/storyblok-autotranslate-datasource.mjs
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

  log("📡", "Fetching base entries (English)...")
  const { data: baseRes } = await api.get(
    `/datasource_entries?datasource_id=${translations.id}&per_page=1000`
  )
  const baseEntries = baseRes.datasource_entries ?? []

  log("📡", "Fetching German dimension entries...")
  const { data: deRes } = await api.get(
    `/datasource_entries?datasource_id=${translations.id}&dimension_id=${deDimension.id}&per_page=1000`
  )

  // Build a map of EMPTY German translations (ones that need filling)
  // NEVER overwrite existing values, even if --force is used
  const emptyDE = new Map()
  deRes.datasource_entries.forEach((e) => {
    if (!e.value || e.value === "") {
      emptyDE.set(e.name, true)
    }
  })

  // Only translate entries with empty German values
  const toTranslate = baseEntries.filter(e => emptyDE.has(e.name))

  log("", "")
  log("🔄", `Processing ${toTranslate.length} empty entries (NEVER overwriting existing values)...`)

  let translated = 0
  let skipped = 0

  for (const entry of toTranslate) {
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
