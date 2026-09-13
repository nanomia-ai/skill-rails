if (process.argv[2] !== "bookmark-storage") {
  process.stderr.write("expected test id bookmark-storage\n");
  process.exitCode = 2;
} else {
  process.stderr.write("bookmark-storage: fixed fixture failure\n");
  process.exitCode = 1;
}
