export function formatBucketLabel(
    date: string,
    granularity: "hour" | "day",
): string {
    if (granularity === "hour" && date.includes("T")) {
        return date.slice(11, 16);
    }
    return date.slice(5);
}
