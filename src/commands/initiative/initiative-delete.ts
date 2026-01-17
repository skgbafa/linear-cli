import { Command } from "@cliffy/command"
import { Confirm, Input } from "@cliffy/prompt"
import { gql } from "../../__codegen__/gql.ts"
import { getGraphQLClient } from "../../utils/graphql.ts"

export const deleteCommand = new Command()
  .name("delete")
  .description("Permanently delete a Linear initiative")
  .arguments("<initiativeId:string>")
  .option("-y, --force", "Skip confirmation prompt")
  .option("--no-color", "Disable colored output")
  .action(async ({ force, color: colorEnabled }, initiativeId) => {
    const client = getGraphQLClient()

    // Resolve initiative ID
    const resolvedId = await resolveInitiativeId(client, initiativeId)
    if (!resolvedId) {
      console.error(`Initiative not found: ${initiativeId}`)
      Deno.exit(1)
    }

    // Get initiative details for confirmation message
    const detailsQuery = gql(`
      query GetInitiativeForDelete($id: String!) {
        initiative(id: $id) {
          id
          slugId
          name
          projects {
            nodes {
              id
            }
          }
        }
      }
    `)

    let initiativeDetails
    try {
      initiativeDetails = await client.request(detailsQuery, { id: resolvedId })
    } catch (error) {
      console.error("Failed to fetch initiative details:", error)
      Deno.exit(1)
    }

    if (!initiativeDetails?.initiative) {
      console.error(`Initiative not found: ${initiativeId}`)
      Deno.exit(1)
    }

    const initiative = initiativeDetails.initiative
    const projectCount = initiative.projects?.nodes?.length || 0

    // Warn about linked projects
    if (projectCount > 0) {
      console.log(
        `\n⚠️  Initiative "${initiative.name}" has ${projectCount} linked project(s).`,
      )
      console.log("Deleting the initiative will unlink these projects.\n")
    }

    // Confirm deletion with typed confirmation for safety
    if (!force) {
      console.log(`\n⚠️  This action is PERMANENT and cannot be undone.\n`)

      const confirmed = await Confirm.prompt({
        message: `Are you sure you want to permanently delete "${initiative.name}"?`,
        default: false,
      })

      if (!confirmed) {
        console.log("Delete cancelled.")
        return
      }

      // Require typing the initiative name for extra safety
      const typedName = await Input.prompt({
        message: `Type the initiative name to confirm deletion:`,
      })

      if (typedName !== initiative.name) {
        console.log("Name does not match. Delete cancelled.")
        return
      }
    }

    const { Spinner } = await import("@std/cli/unstable-spinner")
    const showSpinner = colorEnabled && Deno.stdout.isTerminal()
    const spinner = showSpinner ? new Spinner() : null
    spinner?.start()

    // Delete the initiative
    const deleteMutation = gql(`
      mutation DeleteInitiative($id: String!) {
        initiativeDelete(id: $id) {
          success
        }
      }
    `)

    try {
      const result = await client.request(deleteMutation, { id: resolvedId })

      spinner?.stop()

      if (!result.initiativeDelete.success) {
        console.error("Failed to delete initiative")
        Deno.exit(1)
      }

      console.log(`✓ Permanently deleted initiative: ${initiative.name}`)
    } catch (error) {
      spinner?.stop()
      console.error("Failed to delete initiative:", error)
      Deno.exit(1)
    }
  })

async function resolveInitiativeId(
  // deno-lint-ignore no-explicit-any
  client: any,
  idOrSlugOrName: string,
): Promise<string | undefined> {
  // Try as UUID first
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      idOrSlugOrName,
    )
  ) {
    return idOrSlugOrName
  }

  // Try as slug (including archived - user might want to delete archived initiative)
  const slugQuery = gql(`
    query GetInitiativeBySlugForDelete($slugId: String!) {
      initiatives(filter: { slugId: { eq: $slugId } }, includeArchived: true) {
        nodes {
          id
          slugId
        }
      }
    }
  `)

  try {
    const result = await client.request(slugQuery, { slugId: idOrSlugOrName })
    if (result.initiatives?.nodes?.length > 0) {
      return result.initiatives.nodes[0].id
    }
  } catch {
    // Continue to name lookup
  }

  // Try as name (including archived)
  const nameQuery = gql(`
    query GetInitiativeByNameForDelete($name: String!) {
      initiatives(filter: { name: { eqIgnoreCase: $name } }, includeArchived: true) {
        nodes {
          id
          name
        }
      }
    }
  `)

  try {
    const result = await client.request(nameQuery, { name: idOrSlugOrName })
    if (result.initiatives?.nodes?.length > 0) {
      return result.initiatives.nodes[0].id
    }
  } catch {
    // Not found
  }

  return undefined
}
