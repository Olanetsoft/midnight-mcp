/**
 * Repository tool input schemas
 * Zod schemas for validating tool inputs
 */

import { z } from "zod";

// Schema definitions
export const GetFileInputSchema = z.object({
  repo: z
    .string()
    .describe(
      "Repository name (e.g., 'compact', 'midnight-js', 'example-counter')"
    ),
  path: z.string().describe("File path within repository"),
  ref: z
    .string()
    .optional()
    .describe("Branch, tag, or commit SHA (default: main)"),
});

export const ListExamplesInputSchema = z.object({
  category: z
    .enum(["counter", "bboard", "token", "voting", "all"])
    .optional()
    .default("all")
    .describe("Filter by example type"),
});

export const GetLatestUpdatesInputSchema = z.object({
  since: z
    .string()
    .optional()
    .describe("ISO date to fetch updates from (default: last 7 days)"),
  repos: z
    .array(z.string())
    .optional()
    .describe("Specific repos to check (default: all configured repos)"),
});

export const GetVersionInfoInputSchema = z.object({
  repo: z.string().describe("Repository name (e.g., 'compact', 'midnight-js')"),
});

export const CheckBreakingChangesInputSchema = z.object({
  repo: z.string().describe("Repository name (e.g., 'compact', 'midnight-js')"),
  currentVersion: z
    .string()
    .describe("Version you're currently using (e.g., 'v1.0.0', '0.5.2')"),
});

export const GetMigrationGuideInputSchema = z.object({
  repo: z.string().describe("Repository name (e.g., 'compact', 'midnight-js')"),
  fromVersion: z.string().describe("Version you're migrating from"),
  toVersion: z
    .string()
    .optional()
    .describe("Target version (default: latest stable)"),
});

export const GetFileAtVersionInputSchema = z.object({
  repo: z.string().describe("Repository name (e.g., 'compact', 'midnight-js')"),
  path: z.string().describe("File path within repository"),
  version: z
    .string()
    .describe("Version tag (e.g., 'v1.0.0') or branch (e.g., 'main')"),
});

export const CompareSyntaxInputSchema = z.object({
  repo: z.string().describe("Repository name (e.g., 'compact')"),
  path: z.string().describe("File path to compare"),
  oldVersion: z.string().describe("Old version tag (e.g., 'v0.9.0')"),
  newVersion: z
    .string()
    .optional()
    .describe("New version tag (default: latest)"),
});

export const GetLatestSyntaxInputSchema = z.object({
  repo: z
    .string()
    .default("compact")
    .describe("Repository name (default: 'compact')"),
});

// Compound tool schemas - reduce multiple API calls to one
export const UpgradeCheckInputSchema = z.object({
  repo: z
    .string()
    .default("compact")
    .describe("Repository name (default: 'compact')"),
  currentVersion: z
    .string()
    .describe("Your current version (e.g., 'v0.14.0', '0.13.5')"),
});

export const FullRepoContextInputSchema = z.object({
  repo: z.string().describe("Repository name (e.g., 'compact', 'midnight-js')"),
  includeExamples: z
    .boolean()
    .default(true)
    .describe("Include example code snippets"),
  includeSyntax: z.boolean().default(true).describe("Include syntax reference"),
});

// Inferred types from schemas
export type GetFileInput = z.infer<typeof GetFileInputSchema>;
export type ListExamplesInput = z.infer<typeof ListExamplesInputSchema>;
export type GetLatestUpdatesInput = z.infer<typeof GetLatestUpdatesInputSchema>;
export type GetVersionInfoInput = z.infer<typeof GetVersionInfoInputSchema>;
export type CheckBreakingChangesInput = z.infer<
  typeof CheckBreakingChangesInputSchema
>;
export type GetMigrationGuideInput = z.infer<
  typeof GetMigrationGuideInputSchema
>;
export type GetFileAtVersionInput = z.infer<typeof GetFileAtVersionInputSchema>;
export type CompareSyntaxInput = z.infer<typeof CompareSyntaxInputSchema>;
export type GetLatestSyntaxInput = z.infer<typeof GetLatestSyntaxInputSchema>;
export type UpgradeCheckInput = z.infer<typeof UpgradeCheckInputSchema>;
export type FullRepoContextInput = z.infer<typeof FullRepoContextInputSchema>;
