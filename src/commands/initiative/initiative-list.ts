import { Command } from "@cliffy/command"
import { unicodeWidth } from "@std/cli"
import { open } from "@opensrc/deno-open"
import { gql } from "../../__codegen__/gql.ts"
import { getGraphQLClient } from "../../utils/graphql.ts"
import { padDisplay, truncateText } from "../../utils/display.ts"
import { getOption } from "../../config.ts"

const GetInitiatives = gql(`
  query GetInitiatives($filter: InitiativeFilter) {
    initiatives(filter: $filter) {
      nodes {
        id
        slugId
        name
        description
        status
        targetDate
        health
        color
        icon
        url
        archivedAt
        owner {
          id
          displayName
          initials
        }
        projects {
          nodes {
            id
            name
            status {
              name
            }
          }
        }
      }
    }
  }
`)

// Initiative status display names and order
const INITIATIVE_STATUS_ORDER: Record<string, number> = {
  "active": 1,
  "planned": 2,
  "paused": 3,
  "completed": 4,
  "canceled": 5,
}

const INITIATIVE_STATUS_DISPLAY: Record<string, string> = {
  "active": "Active",
  "planned": "Planned",
  "paused": "Paused",
  "completed": "Completed",
  "canceled": "Canceled",
}

export const listCommand = new Command()
  .name("list")
  .description("List initiatives")
  .option(
    "-s, --status <status:string>",
    "Filter by status (active, planned, paused, completed, canceled)",
  )
  .option("--all-statuses", "Show all statuses (default: active only)")
  .option("-o, --owner <owner:string>", "Filter by owner (username or email)")
  .option("-w, --web", "Open initiatives page in web browser")
  .option("-a, --app", "Open initiatives page in Linear.app")
  .option("-j, --json", "Output as JSON")
  .option("--archived", "Include archived initiatives")
  .action(async ({ status, allStatuses, owner, web, app, json, archived }) => {
    // Handle open in browser/app
    if (web || app) {
      let workspace = getOption("workspace")
      if (!workspace) {
        // Get workspace from viewer if not configured
        const client = getGraphQLClient()
        const viewerQuery = gql(`
          query GetViewerForInitiatives {
            viewer {
              organization {
                urlKey
              }
            }
          }
        `)
        const result = await client.request(viewerQuery)
        workspace = result.viewer.organization.urlKey
      }

      const url = `https://linear.app/${workspace}/initiatives`
      const destination = app ? "Linear.app" : "web browser"
      console.log(`Opening ${url} in ${destination}`)
      await open(url, app ? { app: { name: "Linear" } } : undefined)
      return
    }

    const { Spinner } = await import("@std/cli/unstable-spinner")
    const showSpinner = Deno.stdout.isTerminal() && !json
    const spinner = showSpinner ? new Spinner() : null
    spinner?.start()

    try {
      // Build filter
      // deno-lint-ignore no-explicit-any
      let filter: any = {}

      // Status filter
      if (status) {
        const statusLower = status.toLowerCase()
        const validStatuses = Object.keys(INITIATIVE_STATUS_ORDER)
        if (!validStatuses.includes(statusLower)) {
          spinner?.stop()
          console.error(
            `Invalid status: ${status}. Valid values: ${validStatuses.join(", ")}`,
          )
          Deno.exit(1)
        }
        filter.status = { eq: statusLower }
      } else if (!allStatuses) {
        // Default to active only
        filter.status = { eq: "active" }
      }

      // Owner filter
      if (owner) {
        const { lookupUserId } = await import("../../utils/linear.ts")
        const ownerId = await lookupUserId(owner)
        if (!ownerId) {
          spinner?.stop()
          console.error(`Owner not found: ${owner}`)
          Deno.exit(1)
        }
        filter.owner = { id: { eq: ownerId } }
      }

      // Archived filter
      if (!archived) {
        filter.archivedAt = { null: true }
      }

      const client = getGraphQLClient()
      const result = await client.request(GetInitiatives, {
        filter: Object.keys(filter).length > 0 ? filter : undefined,
      })
      spinner?.stop()

      let initiatives = result.initiatives?.nodes || []

      if (initiatives.length === 0) {
        if (json) {
          console.log("[]")
        } else {
          console.log("No initiatives found.")
        }
        return
      }

      // Sort initiatives by status then by name
      initiatives = initiatives.sort((a, b) => {
        const statusA = INITIATIVE_STATUS_ORDER[a.status] || 999
        const statusB = INITIATIVE_STATUS_ORDER[b.status] || 999

        if (statusA !== statusB) {
          return statusA - statusB
        }

        return a.name.localeCompare(b.name)
      })

      // JSON output
      if (json) {
        const jsonOutput = initiatives.map((init) => ({
          id: init.id,
          slugId: init.slugId,
          name: init.name,
          description: init.description,
          status: init.status,
          health: init.health,
          targetDate: init.targetDate,
          owner: init.owner
            ? {
                id: init.owner.id,
                displayName: init.owner.displayName,
              }
            : null,
          projectCount: init.projects?.nodes?.length || 0,
          url: init.url,
          archivedAt: init.archivedAt,
        }))
        console.log(JSON.stringify(jsonOutput, null, 2))
        return
      }

      // Table output
      const { columns } = Deno.stdout.isTerminal()
        ? Deno.consoleSize()
        : { columns: 120 }

      // Calculate column widths
      const SLUG_WIDTH = Math.max(
        4,
        ...initiatives.map((init) => init.slugId.length),
      )
      const STATUS_WIDTH = Math.max(
        6,
        ...initiatives.map(
          (init) =>
            (INITIATIVE_STATUS_DISPLAY[init.status] || init.status).length,
        ),
      )
      const HEALTH_WIDTH = Math.max(
        6,
        ...initiatives.map((init) => (init.health || "-").length),
      )
      const OWNER_WIDTH = Math.max(
        5,
        ...initiatives.map((init) => (init.owner?.initials || "-").length),
      )
      const PROJECTS_WIDTH = Math.max(
        4,
        ...initiatives.map((init) =>
          String(init.projects?.nodes?.length || 0).length
        ),
      )
      const TARGET_WIDTH = Math.max(
        10,
        ...initiatives.map((init) => (init.targetDate || "-").length),
      )

      const SPACE_WIDTH = 6 // Space between columns
      const fixed =
        SLUG_WIDTH +
        STATUS_WIDTH +
        HEALTH_WIDTH +
        OWNER_WIDTH +
        PROJECTS_WIDTH +
        TARGET_WIDTH +
        SPACE_WIDTH
      const PADDING = 1
      const maxNameWidth = Math.max(
        ...initiatives.map((init) => unicodeWidth(init.name)),
      )
      const availableWidth = Math.max(columns - PADDING - fixed, 10)
      const nameWidth = Math.min(maxNameWidth, availableWidth)

      // Print header
      const headerCells = [
        padDisplay("SLUG", SLUG_WIDTH),
        padDisplay("NAME", nameWidth),
        padDisplay("STATUS", STATUS_WIDTH),
        padDisplay("HEALTH", HEALTH_WIDTH),
        padDisplay("OWNER", OWNER_WIDTH),
        padDisplay("PROJ", PROJECTS_WIDTH),
        padDisplay("TARGET", TARGET_WIDTH),
      ]

      let headerMsg = ""
      const headerStyles: string[] = []
      headerCells.forEach((cell, index) => {
        headerMsg += `%c${cell}`
        headerStyles.push("text-decoration: underline")
        if (index < headerCells.length - 1) {
          headerMsg += "%c %c"
          headerStyles.push("text-decoration: none")
          headerStyles.push("text-decoration: underline")
        }
      })
      console.log(headerMsg, ...headerStyles)

      // Print each initiative
      for (const init of initiatives) {
        const statusDisplay =
          INITIATIVE_STATUS_DISPLAY[init.status] || init.status
        const health = init.health || "-"
        const owner = init.owner?.initials || "-"
        const projectCount = String(init.projects?.nodes?.length || 0)
        const target = init.targetDate || "-"

        const truncName = truncateText(init.name, nameWidth)
        const paddedName = padDisplay(truncName, nameWidth)

        // Get status color
        const statusColors: Record<string, string> = {
          active: "#27AE60",
          planned: "#5E6AD2",
          paused: "#F2994A",
          completed: "#6B6F76",
          canceled: "#EB5757",
        }
        const statusColor = statusColors[init.status] || "#6B6F76"

        console.log(
          `${padDisplay(init.slugId, SLUG_WIDTH)} ${paddedName} %c${padDisplay(statusDisplay, STATUS_WIDTH)}%c ${padDisplay(health, HEALTH_WIDTH)} ${padDisplay(owner, OWNER_WIDTH)} ${padDisplay(projectCount, PROJECTS_WIDTH)} %c${padDisplay(target, TARGET_WIDTH)}%c`,
          `color: ${statusColor}`,
          "",
          "color: gray",
          "",
        )
      }
    } catch (error) {
      spinner?.stop()
      console.error("Failed to fetch initiatives:", error)
      Deno.exit(1)
    }
  })
