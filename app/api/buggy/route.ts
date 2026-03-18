import { NextResponse } from "next/server";
import { createInitialBuggies } from "@/lib/transit/buggy-data";

export async function GET() {
  const buggies = createInitialBuggies();
  return NextResponse.json(buggies);
}
