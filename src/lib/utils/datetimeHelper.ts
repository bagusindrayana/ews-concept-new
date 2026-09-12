export function formatTime(value: string | number | null | undefined): string {
    if (value === null || value === undefined) {
        return "-";
    }

    const str = String(value).trim();

    if (!str) {
        return "-";
    }

    // Format: "2026-09-12 01:00:00"
    // Format: "2026-09-12"
    // Format: "04:23:56"

    let hours = 0;
    let minutes = 0;
    let seconds = 0;

    if (str.includes(" ")) {
        // Datetime
        const timePart = str.split(" ")[1];
        [hours, minutes, seconds] = timePart.split(":").map(Number);

    } else if (/^\d{2}:\d{2}:\d{2}$/.test(str)) {
        // Time
        [hours, minutes, seconds] = str.split(":").map(Number);

    } else if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        // Date saja → default jam 00:00:00
        hours = 0;
        minutes = 0;
        seconds = 0;

    } else {
        return "-";
    }

    // Validasi angka
    if (
        !Number.isInteger(hours) ||
        !Number.isInteger(minutes) ||
        !Number.isInteger(seconds) ||
        hours < 0 || hours > 23 ||
        minutes < 0 || minutes > 59 ||
        seconds < 0 || seconds > 59
    ) {
        return "-";
    }

    // Selalu return HH:mm:ss
    return [
        hours,
        minutes,
        seconds
    ]
        .map(num => String(num).padStart(2, "0"))
        .join(":");
}