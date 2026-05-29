import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    { error: "ระบบเช็กอินด้วยรหัสรอบถูกยกเลิกแล้ว กรุณาเข้าสู่ระบบด้วย Google" },
    { status: 410 }
  );
}
