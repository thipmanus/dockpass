import Link from "next/link";
import { ArrowRight, ClipboardCheck, LockKeyhole, MapPin, Ship, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    title: "เช็กอินด้วย Google",
    description: "ผู้ใช้เข้าสู่ระบบแล้วเห็นเฉพาะรอบที่อีเมลของตนได้รับมอบหมาย",
    icon: ClipboardCheck
  },
  {
    title: "บันทึกตำแหน่งตอนกดเท่านั้น",
    description: "เก็บพิกัด เวลา และความแม่นยำจากเบราว์เซอร์โดยไม่ติดตามเบื้องหลัง",
    icon: MapPin
  },
  {
    title: "สรุปสถานะแบบอ่านง่าย",
    description: "แยกตรงเวลา สาย นอกรอบ เร็วเกินไป และยังไม่เช็กอินในแดชบอร์ดเดียว",
    icon: Ship
  }
];

export default function LandingPage() {
  return (
    <main className="min-h-dvh overflow-x-hidden">
      <section className="border-b bg-white">
        <div className="container flex flex-col justify-center gap-7 py-8 sm:gap-10 sm:py-12 lg:grid lg:min-h-[82dvh] lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-14">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
              <ShieldCheck className="size-4" />
              เวอร์ชันทดลองสำหรับแฟ้มผลงานและใช้งานส่วนตัว
            </div>
            <h1 className="text-balance text-4xl font-bold leading-tight text-slate-950 sm:text-5xl lg:text-6xl">
              DockPass
            </h1>
            <p className="mt-5 max-w-2xl text-pretty text-lg leading-8 text-slate-600">
              แดชบอร์ดเช็กอินรอบงานหรือทริปแบบเบา สำหรับมอบหมายรายชื่อ ตรวจสถานะตามเวลา
              และบันทึกตำแหน่งเฉพาะตอนผู้ใช้กดเช็กอิน
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/admin/dashboard">
                  ไปที่แดชบอร์ดแอดมิน
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                <Link href="/check-in">เปิดพอร์ทัลเช็กอิน</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-lg border bg-slate-950 p-4 text-white shadow-soft sm:p-6">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-sky-200">สถานะวันนี้</p>
                <h2 className="text-2xl font-bold">รอบขนส่งหลัก</h2>
              </div>
              <div className="rounded-md bg-emerald-400/15 px-3 py-2 text-sm font-semibold text-emerald-200">
                ตรงเวลา
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {["จำนวนที่มอบหมาย", "เช็กอินแล้ว", "สาย", "ยังไม่เช็กอิน"].map((label, index) => (
                <div key={label} className="rounded-md border border-white/10 bg-white/5 p-3 sm:p-4">
                  <p className="text-sm text-slate-300">{label}</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums">{[42, 31, 4, 11][index]}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-md border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-slate-300">พอร์ทัลผู้ใช้</p>
              <p className="mt-2 text-xl font-bold">ปฏิทิน · เช็กอิน · ประวัติ</p>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-12 sm:py-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="h-full">
              <CardHeader>
                <feature.icon className="size-9 rounded-md bg-secondary p-2 text-primary" />
                <CardTitle className="text-balance">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-pretty leading-7 text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t bg-white">
        <div className="container py-10">
          <Card className="border-sky-100 bg-sky-50/70">
            <CardContent className="pt-5 sm:pt-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <LockKeyhole className="size-9 shrink-0 rounded-md bg-white p-2 text-primary" />
                <div>
                  <h2 className="text-xl font-semibold">หมายเหตุด้านความปลอดภัยและความเป็นส่วนตัว</h2>
                  <p className="mt-2 text-pretty leading-7 text-slate-600">
                    DockPass ใช้ Supabase Auth, ตรวจสิทธิ์จากอีเมลผู้ใช้ที่เข้าสู่ระบบ, ใช้ API ฝั่งเซิร์ฟเวอร์สำหรับการเขียนข้อมูล
                    และบันทึกตำแหน่งเฉพาะตอนผู้ใช้กดเช็กอินเท่านั้น เหมาะกับการติดตามงานเบื้องต้น
                    ไม่ใช่ระบบป้องกันการทุจริตที่เข้มงวด
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
