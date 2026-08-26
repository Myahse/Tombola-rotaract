function pad(value: number) {
  return String(value).padStart(2, "0");
}

function utcStamp(date: Date) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function escapeIcs(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,").replaceAll("\n", "\\n");
}

function fold(line: string) {
  const chunks: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    chunks.push(rest.slice(0, 75));
    rest = ` ${rest.slice(75)}`;
  }
  chunks.push(rest);
  return chunks.join("\r\n");
}

export function examAppointmentIcs(data: {
  uid: string;
  title: string;
  description: string;
  url: string;
  startsAt: Date;
  durationSeconds: number;
}) {
  const end = new Date(data.startsAt.getTime() + Math.max(data.durationSeconds, 30 * 60) * 1000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rotaract IUGB Club//QCM//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${data.uid}`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(data.startsAt)}`,
    `DTEND:${utcStamp(end)}`,
    fold(`SUMMARY:${escapeIcs(data.title)}`),
    fold(`DESCRIPTION:${escapeIcs(data.description)}`),
    fold(`URL:${data.url}`),
    "LOCATION:En ligne",
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.join("\r\n")}\r\n`;
}
