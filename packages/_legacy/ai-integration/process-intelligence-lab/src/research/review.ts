import { ProcessGraph } from "../domain/process.js";
export interface ReviewAnnotation { id: string; graphId: string; reviewer: string; status: "accepted" | "needs_changes" | "rejected"; comments: string[]; correctedGraph?: ProcessGraph; createdAt: string; }
export function createReview(graphId: string, reviewer: string, status: ReviewAnnotation["status"], comments: string[], correctedGraph?: ProcessGraph): ReviewAnnotation {
  return { id: `REVIEW-${Date.now()}`, graphId, reviewer, status, comments, ...(correctedGraph ? { correctedGraph } : {}), createdAt: new Date().toISOString() };
}
