import { type LlmRequest, simpleRequest, structuredRequest } from '../../llm/types.ts';

// ADR-4: versioned prompt registry。inline プロンプトを集約し prompt_id@version で参照する。
// eval harness（registry.test.ts）が各 spec の system/schema/user 契約を fixture に対し assert し
// プロンプト変更の回帰を検出する。

/** vars 型を消した spec ビュー。ALL_PROMPTS の走査・eval メタ検査に使う。 */
export interface AnyPromptSpec {
  readonly id: string;
  readonly version: number;
  readonly system: string | ((vars: never) => string);
  readonly maxTokens: number;
  readonly webSearch?: boolean;
  readonly schema?: JsonSchema;
}

/** 1 つの versioned プロンプト。system は定数または vars 依存（例: digest のカテゴリ）。 */
export interface PromptSpec<V = void> extends AnyPromptSpec {
  /** system プロンプト。vars に依存する場合は関数。 */
  readonly system: string | ((vars: V) => string);
  /**
   * user プロンプト builder。複雑な builder を別所に持つ spec（deepdive）では省略可。
   * 省略時は buildRequest を使わず呼び出し側で組み立てる。
   */
  readonly user?: (vars: V) => string;
}

/** `id@version` 参照文字列。 */
export function promptRef(spec: { id: string; version: number }): string {
  return `${spec.id}@${spec.version}`;
}

export function resolveSystem<V>(spec: PromptSpec<V>, vars: V): string {
  return typeof spec.system === 'function' ? spec.system(vars) : spec.system;
}

/** spec + vars から LlmRequest を組み立てる（user builder を持つ spec 用）。 */
export function buildRequest<V>(spec: PromptSpec<V>, vars: V): LlmRequest {
  if (spec.user === undefined) {
    throw new Error(`prompt ${promptRef(spec)} has no user builder; build the request manually`);
  }
  const system = resolveSystem(spec, vars);
  const userPrompt = spec.user(vars);
  const base =
    spec.schema !== undefined
      ? structuredRequest(system, userPrompt, spec.maxTokens, spec.schema)
      : simpleRequest(system, userPrompt, spec.maxTokens);
  return spec.webSearch === true ? { ...base, webSearch: true } : base;
}

// ── 最小 JSON Schema バリデータ（eval 用。registry が使う範囲のみ対応） ──

export interface JsonSchema {
  type: 'object' | 'array' | 'string' | 'integer' | 'number' | 'boolean';
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
}

/** schema 自体が整合しているか（object なら required の各キーが properties に存在する等）。 */
export function isWellFormedSchema(schema: JsonSchema): boolean {
  if (schema.type === 'object') {
    if (schema.properties === undefined) return false;
    const props = schema.properties;
    for (const key of schema.required ?? []) {
      if (!(key in props)) return false;
    }
    return Object.values(props).every(isWellFormedSchema);
  }
  if (schema.type === 'array') {
    return schema.items !== undefined && isWellFormedSchema(schema.items);
  }
  return true;
}

function typeMatches(schema: JsonSchema, value: unknown): boolean {
  switch (schema.type) {
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    case 'string':
      return typeof value === 'string';
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'number':
      return typeof value === 'number';
    case 'boolean':
      return typeof value === 'boolean';
    default:
      return false;
  }
}

/** value が schema に適合するか（必須 field・型・配列要素・ネストを検査）。 */
export function validateAgainstSchema(schema: JsonSchema, value: unknown): boolean {
  if (!typeMatches(schema, value)) return false;
  if (schema.type === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in obj)) return false;
    }
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (key in obj && !validateAgainstSchema(sub, obj[key])) return false;
    }
    return true;
  }
  if (schema.type === 'array' && schema.items !== undefined) {
    return (value as unknown[]).every((item) =>
      validateAgainstSchema(schema.items as JsonSchema, item),
    );
  }
  return true;
}
