import {
  describe,
  expect,
  it,
} from "vitest";
import {
  productionEnvironmentIssues,
} from "@/lib/env/server";

describe("production environment", () => {
  it("does not require production-only values in development", () => {
    expect(
      productionEnvironmentIssues({
        NODE_ENV: "development",
      }),
    ).toEqual([]);
  });

  it("accepts a valid production environment", () => {
    expect(
      productionEnvironmentIssues({
        NODE_ENV: "production",
        DATABASE_URL:
          "postgresql://ffz:strong@postgres:5432/ffz_platform",
        FFZ_UPLOAD_DIR:
          "/app/data/uploads",
        AUTH_RATE_LIMIT_SALT:
          "0123456789abcdef0123456789abcdef",
      }),
    ).toEqual([]);
  });

  it("rejects development credentials and non-persistent upload configuration", () => {
    const issues =
      productionEnvironmentIssues({
        NODE_ENV: "production",
        DATABASE_URL:
          "postgresql://ffz:ffz_dev_password@postgres:5432/ffz_platform",
        FFZ_UPLOAD_DIR:
          "data/uploads",
        AUTH_RATE_LIMIT_SALT:
          "short",
      });

    expect(issues.length).toBe(3);
  });
});
