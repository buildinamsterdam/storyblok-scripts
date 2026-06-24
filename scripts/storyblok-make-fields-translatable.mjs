/**
 * Makes all fields translatable in Storyblok components.
 * Sets translatable: true on every field except bloks fields.
 *
 * This allows editors to provide translations (e.g., German) alongside
 * the English default for text, richtext, textarea, asset, and other
 * content fields.
 *
 * Usage:
 *   node scripts/storyblok-make-fields-translatable.mjs
 *
 * Required in .env.local:
 *   STORYBLOK_PERSONAL_MANAGEMENT_TOKEN
 *   STORYBLOK_SPACE_ID
 */

import { loadEnv, createApi, log } from "./storyblok-helper.mjs"

const run = async () => {
  const { token, spaceId } = loadEnv()
  const api = createApi({ token, spaceId })

  log("📡", "Fetching all components...")
  const { data } = await api.get("/components")
  const components = data.components ?? []

  if (components.length === 0) {
    log("❌", "No components found")
    return
  }

  log("📦", `Found ${components.length} components`)

  let updated = 0
  let skipped = 0

  for (const component of components) {
    const schema = component.schema ?? {}
    const fieldNames = Object.keys(schema)

    const translatableFields = fieldNames.filter(
      (name) => schema[name].type !== "bloks"
    )

    if (translatableFields.length === 0) {
      log("⏭", `${component.name} — no translatable fields (only bloks)`)
      skipped++
      continue
    }

    const newSchema = { ...schema }
    translatableFields.forEach((name) => {
      newSchema[name] = { ...schema[name], translatable: true }
    })

    const { status } = await api.put(`/components/${component.id}`, {
      component: { ...component, schema: newSchema },
    })

    if (status === 200) {
      log("✅", `${component.name} — ${translatableFields.length} fields marked translatable`)
      updated++
    } else {
      log("❌", `${component.name} failed (status ${status})`)
    }
  }

  log("", "")
  log("📊", `Updated: ${updated}, Skipped: ${skipped}`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
