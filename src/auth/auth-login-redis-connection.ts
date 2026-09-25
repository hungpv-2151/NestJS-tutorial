export interface RedisConnection {
  connect(): Promise<unknown>;
  eval(
    script: string,
    numberOfKeys: number,
    ...args: string[]
  ): Promise<unknown>;
  quit(): Promise<unknown>;
}
