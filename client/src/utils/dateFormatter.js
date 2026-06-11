/**
 * Timezone-safe date formatting utility mimicking WhatsApp.
 * Handles:
 * - "online" if isOnline is true.
 * - "last seen today at hh:mm am/pm"
 * - "last seen yesterday at hh:mm am/pm"
 * - "last seen dd/mm/yyyy at hh:mm am/pm" for older dates.
 */
export const formatLastSeen = (timestamp) => {
  if (!timestamp) return "offline";

  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "offline";

  const now = new Date();

  // Create date-only midnights for accurate date comparisons regardless of relative hours
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  // Formats time exactly as 12-hour AM/PM: e.g. "02:43 pm"
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12;
  hours = hours ? hours : 12; // Formats 0 as 12
  const formattedHours = hours.toString().padStart(2, "0");
  const timeStr = `${formattedHours}:${minutes} ${ampm}`;

  if (compareDate.getTime() === today.getTime()) {
    return `last seen today at ${timeStr}`;
  } else if (compareDate.getTime() === yesterday.getTime()) {
    return `last seen yesterday at ${timeStr}`;
  } else {
    const day = date.getDate();
    const month = date.getMonth() + 1; // getMonth is 0-indexed
    const year = date.getFullYear();
    return `last seen ${day}/${month}/${year} at ${timeStr}`;
  }
};
