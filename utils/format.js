function cleanName(str) {
  return (str || "")
    .toString()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "");
}

module.exports = { cleanName };