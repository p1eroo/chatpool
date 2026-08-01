export function formatInboxCount(count: number) {
  if (count === 0) return "Sin bandejas";
  if (count === 1) return "1 bandeja";
  return `${count} bandejas`;
}
