import type { DatabaseSync } from 'node:sqlite';
import {
  type CollectionMetrics,
  getCollectionMetrics,
  getLlmByModel,
  getLlmByTask,
  getLlmTotals,
  type LlmModelStat,
  type LlmTaskStat,
  type LlmTotals,
} from '../db/metrics.ts';

// ADR-13: Profile 可視化用のオブザーバビリティ集約。

export interface ObservabilityDto {
  llm: {
    totals: LlmTotals;
    byModel: LlmModelStat[];
    byTask: LlmTaskStat[];
  };
  collection: CollectionMetrics;
}

export function getObservability(db: DatabaseSync): ObservabilityDto {
  return {
    llm: {
      totals: getLlmTotals(db),
      byModel: getLlmByModel(db),
      byTask: getLlmByTask(db),
    },
    collection: getCollectionMetrics(db),
  };
}
