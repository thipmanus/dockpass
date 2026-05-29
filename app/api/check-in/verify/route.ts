import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    { error: "ระบบยืนยันด้วยอีเมลและรหัสรอบถูกยกเลิกแล้ว กรุณาเข้าสู่ระบบด้วย Google" },
    { status: 410 }
  );
}
