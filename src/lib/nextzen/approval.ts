import type { TaskRecord } from "./types.ts";

/**
 * A high-risk result stays locked until the person records an explicit review.
 * While locked, the UI must not offer copy or export of commands and scripts.
 * Approval only records that the result was reviewed; it never means anything was executed.
 */
export function isLocked(record: Pick<TaskRecord, "acknowledged" | "result">): boolean {
  return record.result.approvalRequired && !record.result.refused && !record.acknowledged;
}
