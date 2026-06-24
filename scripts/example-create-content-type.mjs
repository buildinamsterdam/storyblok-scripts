/**
 * Example: Create a custom content type in Storyblok
 *
 * This demonstrates how to use the storyblok-helper to create new components
 * (content types, blocks, or elements) with a defined schema.
 *
 * Pattern:
 * 1. Load environment (token, space ID)
 * 2. Create API client
 * 3. Fetch existing components to check for duplicates
 * 4. Create component with schema
 * 5. Handle errors gracefully
 *
 * Usage:
 *   node scripts/example-create-content-type.mjs
 *
 * Required in .env.local:
 *   STORYBLOK_PERSONAL_MANAGEMENT_TOKEN
 *   STORYBLOK_SPACE_ID
 */

import { loadEnv, createApi, log } from "./storyblok-helper.mjs"

const run = async () => {
  const { token, spaceId } = loadEnv()
  const api = createApi({ token, spaceId })

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1: Check if component already exists
  // ─────────────────────────────────────────────────────────────────────────
  log("📡", "Fetching existing components...")
  const { data: listRes } = await api.get("/components")
  const components = listRes.components ?? []

  const componentName = "block_example_feature"
  const existing = components.find((c) => c.name === componentName)

  if (existing) {
    log("⏭", `Component already exists: ${componentName}`)
    return
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 2: Define the component schema
  // ─────────────────────────────────────────────────────────────────────────
  // Schema defines the fields editors can manage in the Storyblok UI
  const schema = {
    // Text field
    title: {
      type: "text",
      display_name: "Title",
      required: true,
      pos: 0,
    },

    // Rich text field (supports formatting, links, etc.)
    description: {
      type: "richtext",
      display_name: "Description",
      pos: 1,
    },

    // Image field
    image: {
      type: "asset",
      display_name: "Feature Image",
      filetypes: ["images"],
      pos: 2,
    },

    // Boolean toggle
    is_featured: {
      type: "boolean",
      display_name: "Mark as Featured",
      pos: 3,
    },

    // Single-select dropdown
    status: {
      type: "option",
      display_name: "Status",
      pos: 4,
      source: "undefined",
      options: [
        { name: "Draft", value: "draft" },
        { name: "Published", value: "published" },
        { name: "Archived", value: "archived" },
      ],
    },

    // Nested components (for sub-elements)
    items: {
      type: "bloks",
      display_name: "Feature Items",
      pos: 5,
      restrict_components: true,
      component_whitelist: ["element_feature_item"],
    },
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 3: Create the component
  // ─────────────────────────────────────────────────────────────────────────
  log("🆕", `Creating component: ${componentName}`)

  const { status, data: createRes } = await api.post("/components", {
    component: {
      name: componentName,
      display_name: "Example Feature Block",
      is_root: false, // false = block/element, true = entity/page
      is_nestable: true, // Can be nested in other blocks
      schema: schema,
    },
  })

  if (status === 201 || status === 200) {
    log("✅", `Component created: ${componentName}`)
    log("   ", `ID: ${createRes.component.id}`)
  } else {
    log("❌", `Failed to create component (status ${status})`)
    log("   ", JSON.stringify(createRes, null, 2))
    process.exit(1)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 4: Create a dependency (element) for the nested bloks field
  // ─────────────────────────────────────────────────────────────────────────
  log("", "")
  log("🆕", "Creating dependent component: element_feature_item")

  const itemSchema = {
    label: {
      type: "text",
      display_name: "Label",
      required: true,
      pos: 0,
    },
    icon: {
      type: "asset",
      display_name: "Icon",
      filetypes: ["images"],
      pos: 1,
    },
  }

  const { status: itemStatus, data: itemRes } = await api.post("/components", {
    component: {
      name: "element_feature_item",
      display_name: "Feature Item Element",
      is_root: false,
      is_nestable: true,
      schema: itemSchema,
    },
  })

  if (itemStatus === 201 || itemStatus === 200) {
    log("✅", "Element created: element_feature_item")
  } else if (itemRes.error?.[0]?.includes("already exists")) {
    log("⏭", "Element already exists: element_feature_item")
  } else {
    log("❌", `Failed to create element (status ${itemStatus})`)
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
