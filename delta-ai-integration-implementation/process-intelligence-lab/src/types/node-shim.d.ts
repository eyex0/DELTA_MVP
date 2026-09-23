declare module "node:fs/promises" {
  export function readFile(path: string, encoding: "utf8"): Promise<string>;
  export function mkdir(path: string, options: { recursive: boolean }): Promise<void>;
  export function writeFile(path: string, data: string, encoding: "utf8"): Promise<void>;
}

declare module "node:path" {
  export function dirname(path: string): string;
}

declare module "node:http" {
  export interface IncomingMessage extends AsyncIterable<Uint8Array> { method?: string; url?: string; }
  export interface ServerResponse { writeHead(status: number, headers: Record<string, string>): void; end(body?: string): void; }
  export interface Server { listen(port: number, callback?: () => void): void; close(callback?: () => void): void; }
  export function createServer(handler: (request: IncomingMessage, response: ServerResponse) => void | Promise<void>): Server;
}

declare module "node:test" {
  type TestFn = (name: string, fn: () => void | Promise<void>) => void;
  const test: TestFn;
  export default test;
}

declare module "node:assert/strict" {
  const assert: {
    equal(actual: unknown, expected: unknown): void;
    match(actual: string, expected: RegExp): void;
    ok(value: unknown): void;
    throws(fn: () => unknown, expected?: RegExp): void;
  };
  export default assert;
}

declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
  exit(code?: number): never;
};
