import { z } from "zod/v4";

export const DiscoveryExtractionSchema = z.object({
  requirements: z.array(
    z.object({
      description: z.string().min(3),
      category: z.enum(["functional", "non_functional", "integration"]),
      priority: z.enum(["high", "medium", "low"]),
    }),
  ),
  risks: z.array(
    z.object({
      description: z.string().min(3),
      impact: z.enum(["high", "medium", "low"]),
    }),
  ),
  decisions: z.array(z.object({ description: z.string().min(3) })),
  open_items: z.array(
    z.object({
      description: z.string().min(3),
      owner: z.string().optional(),
    }),
  ),
  scope_boundary: z.object({
    in_scope: z.array(z.string()),
    out_of_scope: z.array(z.string()),
    assumptions: z.array(z.string()),
    dependencies: z.array(z.string()),
  }),
  brd: z.object({ title: z.string(), summary: z.string().min(10) }),
  confidence: z.enum(["high", "medium", "low"]),
  confidence_reason: z.string().optional(),
});

export type DiscoveryExtraction = z.infer<typeof DiscoveryExtractionSchema>;
