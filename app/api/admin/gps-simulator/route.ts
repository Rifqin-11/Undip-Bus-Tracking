import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import {
  getServerGpsSimulatorStatus,
  startServerGpsSimulator,
  stopServerGpsSimulator,
  type ServerGpsSimulatorStartOptions,
} from "@/lib/server/gps-simulator/server-simulator";
import { getErrorMessage } from "@/lib/utils/error-message";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const adminGuard = await requireAdmin();
  if (!adminGuard.authorized) return adminGuard.response;

  return NextResponse.json(getServerGpsSimulatorStatus());
}

export async function POST(request: Request) {
  const adminGuard = await requireAdmin();
  if (!adminGuard.authorized) return adminGuard.response;

  let body: ServerGpsSimulatorStartOptions = {};
  try {
    body = (await request.json()) as ServerGpsSimulatorStartOptions;
  } catch {
    body = {};
  }

  try {
    const status = await startServerGpsSimulator(body);
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const adminGuard = await requireAdmin();
  if (!adminGuard.authorized) return adminGuard.response;

  try {
    const status = await stopServerGpsSimulator();
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
