// Runs every end-to-end scenario one after another (each starts fresh users).
const { execFileSync } = require("child_process");
const path = require("path");
let failed = 0;
for (const f of ["run1", "run2", "run3", "run4", "run5", "run6", "run7"]) {
  console.log(`\n##### ${f}`);
  try {
    execFileSync(process.execPath, [path.join(__dirname, f + ".cjs")], { stdio: "inherit" });
  } catch (_) {
    failed++;
  }
}
process.exit(failed ? 1 : 0);
