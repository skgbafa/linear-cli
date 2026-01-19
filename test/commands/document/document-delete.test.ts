import { snapshotTest } from "@cliffy/testing"
import { deleteCommand } from "../../../src/commands/document/document-delete.ts"
import { MockLinearServer } from "../../utils/mock_linear_server.ts"
import { commonDenoArgs } from "../../utils/test-helpers.ts"

// Test help output
await snapshotTest({
  name: "Document Delete Command - Help Text",
  meta: import.meta,
  colors: false,
  args: ["--help"],
  denoArgs: commonDenoArgs,
  async fn() {
    await deleteCommand.parse()
  },
})

// Test soft delete (trash)
await snapshotTest({
  name: "Document Delete Command - Soft Delete",
  meta: import.meta,
  colors: false,
  args: ["d4b93e3b2695", "-y"],
  denoArgs: commonDenoArgs,
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "DeleteDocument",
        variables: { id: "d4b93e3b2695" },
        response: {
          data: {
            documentDelete: {
              success: true,
            },
          },
        },
      },
    ])

    try {
      await server.start()
      Deno.env.set("LINEAR_GRAPHQL_ENDPOINT", server.getEndpoint())
      Deno.env.set("LINEAR_API_KEY", "Bearer test-token")

      await deleteCommand.parse()
    } finally {
      await server.stop()
      Deno.env.delete("LINEAR_GRAPHQL_ENDPOINT")
      Deno.env.delete("LINEAR_API_KEY")
    }
  },
})

// Test permanent delete
await snapshotTest({
  name: "Document Delete Command - Permanent Delete",
  meta: import.meta,
  colors: false,
  args: ["d4b93e3b2695", "--permanent", "-y"],
  denoArgs: commonDenoArgs,
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "DeleteDocumentPermanent",
        variables: { id: "d4b93e3b2695" },
        response: {
          data: {
            documentDelete: {
              success: true,
            },
          },
        },
      },
    ])

    try {
      await server.start()
      Deno.env.set("LINEAR_GRAPHQL_ENDPOINT", server.getEndpoint())
      Deno.env.set("LINEAR_API_KEY", "Bearer test-token")

      await deleteCommand.parse()
    } finally {
      await server.stop()
      Deno.env.delete("LINEAR_GRAPHQL_ENDPOINT")
      Deno.env.delete("LINEAR_API_KEY")
    }
  },
})

// Test document not found
await snapshotTest({
  name: "Document Delete Command - Document Not Found",
  meta: import.meta,
  colors: false,
  args: ["nonexistent123", "-y"],
  denoArgs: commonDenoArgs,
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "DeleteDocument",
        variables: { id: "nonexistent123" },
        response: {
          errors: [{
            message: "Document not found: nonexistent123",
            extensions: { code: "NOT_FOUND" },
          }],
        },
      },
    ])

    try {
      await server.start()
      Deno.env.set("LINEAR_GRAPHQL_ENDPOINT", server.getEndpoint())
      Deno.env.set("LINEAR_API_KEY", "Bearer test-token")

      try {
        await deleteCommand.parse()
      } catch (error) {
        console.log(`Error: ${(error as Error).message}`)
      }
    } finally {
      await server.stop()
      Deno.env.delete("LINEAR_GRAPHQL_ENDPOINT")
      Deno.env.delete("LINEAR_API_KEY")
    }
  },
})

// Test bulk delete
await snapshotTest({
  name: "Document Delete Command - Bulk Delete",
  meta: import.meta,
  colors: false,
  args: ["--bulk", "d4b93e3b2695", "25a3c439c040", "-y"],
  denoArgs: commonDenoArgs,
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "DeleteDocument",
        variables: { id: "d4b93e3b2695" },
        response: {
          data: {
            documentDelete: {
              success: true,
            },
          },
        },
      },
      {
        queryName: "DeleteDocument",
        variables: { id: "25a3c439c040" },
        response: {
          data: {
            documentDelete: {
              success: true,
            },
          },
        },
      },
    ])

    try {
      await server.start()
      Deno.env.set("LINEAR_GRAPHQL_ENDPOINT", server.getEndpoint())
      Deno.env.set("LINEAR_API_KEY", "Bearer test-token")

      await deleteCommand.parse()
    } finally {
      await server.stop()
      Deno.env.delete("LINEAR_GRAPHQL_ENDPOINT")
      Deno.env.delete("LINEAR_API_KEY")
    }
  },
})

// Test permission error
await snapshotTest({
  name: "Document Delete Command - Permission Error",
  meta: import.meta,
  colors: false,
  args: ["d4b93e3b2695", "-y"],
  denoArgs: commonDenoArgs,
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "DeleteDocument",
        variables: { id: "d4b93e3b2695" },
        response: {
          errors: [{
            message: "You don't have permission to delete this document",
            extensions: { code: "FORBIDDEN" },
          }],
        },
      },
    ])

    try {
      await server.start()
      Deno.env.set("LINEAR_GRAPHQL_ENDPOINT", server.getEndpoint())
      Deno.env.set("LINEAR_API_KEY", "Bearer test-token")

      try {
        await deleteCommand.parse()
      } catch (error) {
        console.log(`Error: ${(error as Error).message}`)
      }
    } finally {
      await server.stop()
      Deno.env.delete("LINEAR_GRAPHQL_ENDPOINT")
      Deno.env.delete("LINEAR_API_KEY")
    }
  },
})

// Test missing document ID
await snapshotTest({
  name: "Document Delete Command - Missing ID",
  meta: import.meta,
  colors: false,
  args: [],
  denoArgs: commonDenoArgs,
  async fn() {
    try {
      await deleteCommand.parse()
    } catch (error) {
      console.log(`Error: ${(error as Error).message}`)
    }
  },
})
