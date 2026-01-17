import { Command } from "@cliffy/command"

import { archiveCommand } from "./initiative-archive.ts"
import { updateCommand } from "./initiative-update.ts"
import { unarchiveCommand } from "./initiative-unarchive.ts"
import { deleteCommand } from "./initiative-delete.ts"

// Note: list, view, create commands will be added by TC-516 and TC-517

export const initiativeCommand = new Command()
  .description("Manage Linear initiatives")
  .action(function () {
    this.showHelp()
  })
  .command("archive", archiveCommand)
  .command("update", updateCommand)
  .command("unarchive", unarchiveCommand)
  .command("delete", deleteCommand)
