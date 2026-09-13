export function createBookmarkStorage() {
  const bookmarks = new Map();
  return {
    add(id, url) {
      if (typeof id !== "string" || id.length === 0 || typeof url !== "string" || !url.startsWith("https://")) throw new TypeError("invalid bookmark");
      bookmarks.set(id, url);
    },
    get(id) {
      return bookmarks.get(id) ?? null;
    },
  };
}
