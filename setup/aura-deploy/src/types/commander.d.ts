declare module 'commander' {
  export class Command {
    constructor(name?: string);
    name(str: string): this;
    description(str: string): this;
    version(str: string, flags?: string, description?: string): this;
    command(nameAndArgs: string, opts?: Record<string, unknown>): Command;
    argument(name: string, description?: string, defaultValue?: unknown): this;
    option(flags: string, description?: string, defaultValue?: unknown): this;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    action(fn: (...args: any[]) => void | Promise<void>): this;
    addCommand(cmd: Command): this;
    parse(argv?: readonly string[]): this;
  }
}
