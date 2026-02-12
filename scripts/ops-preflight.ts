import { validateRuntimeEnvironment } from "../server/envValidation";

const result = validateRuntimeEnvironment(process.env);

console.log("FirstUser Ops Preflight");
console.log(`Environment: ${process.env.NODE_ENV || "development"}`);

if (result.warnings.length > 0) {
  console.log("\nWarnings:");
  for (const warning of result.warnings) {
    console.log(`- ${warning}`);
  }
}

if (result.errors.length > 0) {
  console.error("\nErrors:");
  for (const error of result.errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("\nNo blocking environment errors found.");
