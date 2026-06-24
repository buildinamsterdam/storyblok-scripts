/**
 * Storyblok Management API helper — shared utilities for Storyblok scripts.
 * No dependencies, only Node.js built-ins.
 */

import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

/**
 * Load environment variables from .env.local
 * Sets process.env keys if not already set (env vars take precedence).
 *
 * @param {string} [envPath] - Path to .env.local. Defaults to ../../../.env.local relative to this file.
 * @returns {{ token: string, spaceId: string }} - STORYBLOK_PERSONAL_MANAGEMENT_TOKEN and STORYBLOK_SPACE_ID
 * @throws {Error} - If either required var is missing
 *
 * @example
 * const { token, spaceId } = loadEnv()
 */
export const loadEnv = (envPath) => {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const path = envPath ?? resolve(__dirname, "../.env.local")

  try {
    const lines = readFileSync(path, "utf8").split("\n")
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "")
      if (!(key in process.env)) process.env[key] = val
    }
  } catch {
    // File not found is OK — rely on environment vars
  }

  const token = process.env.STORYBLOK_PERSONAL_MANAGEMENT_TOKEN
  const spaceIdRaw = process.env.STORYBLOK_SPACE_ID ?? ""
  const spaceId = spaceIdRaw.replace(/^#/, "")

  if (!token || !spaceId) {
    console.error(
      "Missing STORYBLOK_PERSONAL_MANAGEMENT_TOKEN or STORYBLOK_SPACE_ID in .env.local or environment"
    )
    process.exit(1)
  }

  return { token, spaceId }
}

/**
 * Create a Storyblok Management API client.
 *
 * @param {{ token: string, spaceId: string, delayMs?: number }} opts
 * @returns {{ get: Function, post: Function, put: Function, del: Function }}
 *
 * @example
 * const api = createApi({ token, spaceId })
 * const { status, data } = await api.get("/components")
 */
export const createApi = ({ token, spaceId, delayMs = 300 }) => {
  const BASE = `https://mapi.storyblok.com/v1/spaces/${spaceId}`
  const HEADERS = { Authorization: token, "Content-Type": "application/json" }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  const request = async (method, path, body) => {
    await sleep(delayMs)
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: HEADERS,
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await res.json().catch(() => ({}))
    return { status: res.status, data: json }
  }

  const get = (path) => request("GET", path)

  /**
   * Paginate through all results for a list endpoint.
   * Stops when a page returns fewer items than per_page.
   *
   * @param {string} path - API path (e.g. "/stories", "/assets")
   * @param {Record<string, string>} [params] - Additional query params
   * @returns {Promise<any[]>} - Flattened array of all items
   */
  const getAll = async (path, params = {}) => {
    const items = []
    let page = 1
    while (true) {
      const query = new URLSearchParams({ ...params, per_page: "100", page: String(page) }).toString()
      const { status, data } = await get(`${path}?${query}`)
      if (status !== 200) break
      const arr = Object.values(data).find((v) => Array.isArray(v)) ?? []
      items.push(...arr)
      if (arr.length < 100) break
      page++
    }
    return items
  }

  return {
    get,
    getAll,
    post: (path, body) => request("POST", path, body),
    put: (path, body) => request("PUT", path, body),
    del: (path) => request("DELETE", path),
  }
}

/**
 * Log a message with an emoji prefix.
 * Consistent output formatting for scripts.
 *
 * @param {string} emoji - Emoji character
 * @param {string} msg - Message text
 *
 * @example
 * log("✅", "Component updated")
 */
export const log = (emoji, msg) => console.log(`${emoji}  ${msg}`)
