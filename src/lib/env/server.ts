import path from "node:path";

export function productionEnvironmentIssues(
  env: NodeJS.ProcessEnv = process.env,
) {
  if (env.NODE_ENV !== "production") {
    return [];
  }

  const issues: string[] = [];

  const databaseUrl =
    env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    issues.push(
      "DATABASE_URL is required.",
    );
  } else {
    if (
      !databaseUrl.startsWith(
        "postgresql://",
      ) &&
      !databaseUrl.startsWith(
        "postgres://",
      )
    ) {
      issues.push(
        "DATABASE_URL must use PostgreSQL.",
      );
    }

    if (
      databaseUrl.includes(
        "ffz_dev_password",
      )
    ) {
      issues.push(
        "DATABASE_URL still contains the development database password.",
      );
    }
  }

  const uploadDir =
    env.FFZ_UPLOAD_DIR?.trim();

  if (!uploadDir) {
    issues.push(
      "FFZ_UPLOAD_DIR is required in production so Journal screenshots can use persistent storage.",
    );
  } else if (
    !path.isAbsolute(uploadDir)
  ) {
    issues.push(
      "FFZ_UPLOAD_DIR must be an absolute path in production.",
    );
  }

  const salt =
    env.AUTH_RATE_LIMIT_SALT?.trim();

  if (!salt || salt.length < 32) {
    issues.push(
      "AUTH_RATE_LIMIT_SALT must contain at least 32 characters in production.",
    );
  }

  return issues;
}

export function assertProductionEnvironment(
  env: NodeJS.ProcessEnv = process.env,
) {
  const issues =
    productionEnvironmentIssues(env);

  if (issues.length > 0) {
    throw new Error(
      [
        "FFZ production environment is not ready:",
        ...issues.map(
          (issue) => `- ${issue}`,
        ),
      ].join("\n"),
    );
  }
}
