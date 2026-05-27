const path = require("path");

const dotenv = require("dotenv");

function getArgValue(args, name) {
  const inlineArg = args.find((arg) => arg.startsWith(`${name}=`));

  if (inlineArg) {
    return inlineArg.slice(name.length + 1);
  }

  const argIndex = args.indexOf(name);

  if (argIndex >= 0) {
    return args[argIndex + 1];
  }

  return "";
}

function loadEnvironment({ args = process.argv.slice(2), defaultEnvFile = ".env" } = {}) {
  const explicitEnvFile =
    getArgValue(args, "--env-path") || getArgValue(args, "--env-file") || process.env.ENV_FILE;
  const envFileArg = explicitEnvFile || defaultEnvFile;
  const envFile = path.resolve(process.cwd(), envFileArg);
  const dotenvResult = dotenv.config({ path: envFile });

  if (explicitEnvFile && dotenvResult.error) {
    throw new Error(`Environment file not found or unreadable: ${envFileArg}`);
  }

  if (args.includes("--production")) {
    process.env.NODE_ENV = "production";
  }

  return {
    args,
    envFile,
    isProduction: process.env.NODE_ENV === "production",
  };
}

module.exports = {
  getArgValue,
  loadEnvironment,
};
