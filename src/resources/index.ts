export {
  documentationResources,
  getDocumentation,
  listDocumentationResources,
} from "./docs.js";

export { codeResources, getCode, listCodeResources } from "./code.js";

export { schemaResources, getSchema, listSchemaResources } from "./schemas.js";

export type { ResourceDefinition } from "./schemas.js";

// Combine all resources
import { documentationResources } from "./docs.js";
import { codeResources } from "./code.js";
import { schemaResources } from "./schemas.js";

export const allResources = [
  ...documentationResources,
  ...codeResources,
  ...schemaResources,
];
