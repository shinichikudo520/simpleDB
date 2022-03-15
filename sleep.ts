export function sleep(mill: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, mill));
}
