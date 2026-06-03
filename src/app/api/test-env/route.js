import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const envKeys = Object.keys(process.env);
  const dbEnv = {};

  for (const key of envKeys) {
    if (key.includes("STORAGE") || key.includes("POSTGRES")) {
      const val = process.env[key] || "";
      dbEnv[key] = {
        defined: true,
        length: val.length,
        hasPooler: val.includes("-pooler"),
        startsWithPostgres: val.startsWith("postgres://") || val.startsWith("postgresql://"),
      };
    }
  }

  return NextResponse.json({
    dbEnv,
    nodeEnv: process.env.NODE_ENV,
  });
}
