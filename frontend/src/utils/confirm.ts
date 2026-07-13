export function showConfirm(message: string): boolean {
  const c = (window as unknown as { confirm: (msg: string) => boolean }).confirm;
  return c ? c(message) : true;
}
