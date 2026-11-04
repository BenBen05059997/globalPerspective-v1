// A story arc, on the country list and the country page alike: a thread with at least two entries for the country.
const MIN_ARC_ENTRIES = 2;

export const isArc = (entryCount) => entryCount >= MIN_ARC_ENTRIES;
