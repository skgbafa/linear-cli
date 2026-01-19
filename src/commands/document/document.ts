import { Command } from "@cliffy/command"
import { createCommand } from "./document-create.ts"
import { updateCommand } from "./document-update.ts"
import { deleteCommand } from "./document-delete.ts"

export const documentCommand = new Command()
  .name("document")
  .description("Manage Linear documents")
  .alias("docs")
  .alias("doc")
  .action(() => {
    console.log("Use --help to see available subcommands")
  })
  .command("create", createCommand)
  .command("update", updateCommand)
  .command("delete", deleteCommand)
