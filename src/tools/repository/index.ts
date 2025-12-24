/**
 * Repository module exports
 * Barrel file for repository-related tools
 */

// Schemas and types
export {
  GetFileInputSchema,
  ListExamplesInputSchema,
  GetLatestUpdatesInputSchema,
  GetVersionInfoInputSchema,
  CheckBreakingChangesInputSchema,
  GetMigrationGuideInputSchema,
  GetFileAtVersionInputSchema,
  CompareSyntaxInputSchema,
  GetLatestSyntaxInputSchema,
  ValidateContractInputSchema,
  ExtractContractStructureInputSchema,
  type GetFileInput,
  type ListExamplesInput,
  type GetLatestUpdatesInput,
  type GetVersionInfoInput,
  type CheckBreakingChangesInput,
  type GetMigrationGuideInput,
  type GetFileAtVersionInput,
  type CompareSyntaxInput,
  type GetLatestSyntaxInput,
  type ValidateContractInput,
  type ExtractContractStructureInput,
} from "./schemas.js";

// Constants
export { REPO_ALIASES, EXAMPLES, type ExampleDefinition } from "./constants.js";

// Handlers
export {
  resolveRepo,
  getFile,
  listExamples,
  getLatestUpdates,
  getVersionInfo,
  checkBreakingChanges,
  getMigrationGuide,
  getFileAtVersion,
  compareSyntax,
  getLatestSyntax,
  validateContract,
  extractContractStructure,
} from "./handlers.js";

// Tools
export { repositoryTools } from "./tools.js";
