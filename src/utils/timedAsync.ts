export default async function timedAsync<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T> | T,
  ...args: Args
): Promise<T> {
  const start = process.hrtime.bigint(); // nanoseconds

  const result = await fn(...args);

  const end = process.hrtime.bigint();
  const durationMs = Number(end - start) / 1_000_000; // convert ns → ms

  console.log(`Execution time: ${durationMs.toFixed(3)} ms`);
  return result;
}
