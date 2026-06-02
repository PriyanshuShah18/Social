import { NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import ConnectedAccount from "@/models/ConnectedAccount";

/**
 * GET /api/accounts
 * List all connected accounts (tokens are redacted).
 */
export async function GET() {
  try {
    await connectDB();

    const accounts = await ConnectedAccount.find()
      .select("-accessToken -refreshToken")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ accounts });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/accounts
 * Disconnect an account by ID.
 * Body: { accountId: string }
 */
export async function DELETE(request: Request) {
  try {
    await connectDB();

    const body = await request.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: "Missing accountId" },
        { status: 400 }
      );
    }

    const result = await ConnectedAccount.findByIdAndDelete(accountId);
    if (!result) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, deleted: accountId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
