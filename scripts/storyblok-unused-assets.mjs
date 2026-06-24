/**
 * Find (and optionally delete) assets that are not referenced in any story.
 *
 * By default this is a dry run — it reports unused assets and how much storage
 * could be freed. Pass --delete to permanently remove them.
 *
 * Usage:
 *   node scripts/storyblok-unused-assets.mjs
 *   node scripts/storyblok-unused-assets.mjs --folder-id=123456
 *   node scripts/storyblok-unused-assets.mjs --delete
 *   node scripts/storyblok-unused-assets.mjs --folder-id=123456 --delete
 *
 * ⚠️  Assets used outside of Storyblok (hardcoded in code, CSS, external tools)
 *     will appear as unused. Review the list before deleting.
 */

import { loadEnv, createApi, log } from "./storyblok-helper.mjs"

const args = process.argv.slice(2)
const folderId = args.find((a) => a.startsWith("--folder-id="))?.split("=")[1]
const doDelete = args.includes("--delete")

/** Strip CDN domain and return only the path portion for URL matching. */
const assetPath = (filename) => {
  if (typeof filename !== "string") return filename
  const idx = filename.search(/\/a(-[a-z]+)?\.storyblok\.com\//)
  return idx === -1 ? filename : filename.slice(idx)
}

const formatMB = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

async function run() {
  const { token, spaceId } = loadEnv()
  const api = createApi({ token, spaceId })

  // 1. Fetch all story stubs, then their full content for URL matching
  log("📖", "Fetching all stories...")
  const stubs = await api.getAll("/stories")
  log("⏳", `Fetching full content for ${stubs.length} stories...`)

  const contents = []
  for (let i = 0; i < stubs.length; i++) {
    const { status, data } = await api.get(`/stories/${stubs[i].id}`)
    if (status === 200 && data.story) contents.push(data.story)
    if ((i + 1) % 20 === 0) log("⏳", `  ${i + 1}/${stubs.length} stories loaded...`)
  }

  const storiesStr = JSON.stringify(contents)
  log("✅", `Loaded ${contents.length} stories`)

  // 2. Fetch all assets (optionally filtered to a folder)
  log("🖼️ ", `Fetching assets${folderId ? ` in folder ${folderId}` : ""}...`)
  const assetParams = folderId ? { asset_folder_id: folderId } : {}
  const assets = await api.getAll("/assets", assetParams)
  log("✅", `Found ${assets.length} assets`)

  // 3. Find assets whose CDN path does not appear anywhere in story content
  const unused = assets.filter((asset) => storiesStr.indexOf(assetPath(asset.filename)) === -1)
  const unusedBytes = unused.reduce((sum, a) => sum + (a.content_length ?? 0), 0)

  console.log("")
  log("📊", `Results: ${unused.length} unused of ${assets.length} total assets`)
  log("💾", `Reclaimable storage: ${formatMB(unusedBytes)}`)
  console.log("")

  if (unused.length === 0) {
    log("🎉", "No unused assets found!")
    return
  }

  // Print the list
  for (const asset of unused) {
    const name = asset.filename.split("/").at(-1)
    const size = asset.content_length ? ` (${formatMB(asset.content_length)})` : ""
    log("  🗂️ ", `${name}${size}`)
  }

  console.log("")

  if (!doDelete) {
    log("ℹ️ ", "Dry run — run with --delete to permanently remove these assets")
    log("⚠️ ", "Review the list first: assets used outside Storyblok will appear here too")
    return
  }

  // 4. Delete
  log("🗑️ ", `Deleting ${unused.length} assets...`)
  let deleted = 0
  let failed = 0

  for (const asset of unused) {
    const { status } = await api.del(`/assets/${asset.id}`)
    if (status === 200 || status === 204) {
      deleted++
    } else {
      log("❌", `Failed: ${asset.filename.split("/").at(-1)}`)
      failed++
    }
  }

  log("🎉", `Done. Deleted: ${deleted}, Failed: ${failed}, Freed: ${formatMB(unusedBytes)}`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
