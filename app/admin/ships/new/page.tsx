"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, Check, CheckCircle2, Clipboard, Copy, Search, Ship, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateTimeDisplayInput } from "@/components/ui/date-display-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatThaiDateRangeDisplay, formatThaiDateTimeDisplay } from "@/lib/date-format";
import { parseEmailList } from "@/lib/email";

type CreateResponse = {
  ship: {
    id: string;
    title: string;
    description: string;
    remark: string | null;
    start_at: string;
    end_at: string;
  };
  portal_link: string;
  assigned_emails: string[];
};

type EmailListResponse = {
  emails: string[];
};

async function readJsonResponse(response: Response) {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export default function NewShipPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [remark, setRemark] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [assignedEmails, setAssignedEmails] = useState("");
  const [earlyCheckinMinutes, setEarlyCheckinMinutes] = useState(5);
  const [onTimeUntilMinutes, setOnTimeUntilMinutes] = useState(10);
  const [closeBeforeEndMinutes, setCloseBeforeEndMinutes] = useState(5);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateResponse | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [emailPickerOpen, setEmailPickerOpen] = useState(false);
  const [emailOptions, setEmailOptions] = useState<string[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [emailSearch, setEmailSearch] = useState("");
  const [emailPickerLoading, setEmailPickerLoading] = useState(false);
  const [emailPickerError, setEmailPickerError] = useState<string | null>(null);

  const normalizedEmails = useMemo(() => parseEmailList(assignedEmails), [assignedEmails]);
  const filteredEmailOptions = useMemo(() => {
    const search = emailSearch.trim().toLowerCase();
    if (!search) {
      return emailOptions;
    }

    return emailOptions.filter((email) => email.includes(search));
  }, [emailOptions, emailSearch]);

  function resetForm() {
    setTitle("");
    setDescription("");
    setRemark("");
    setStartAt("");
    setEndAt("");
    setAssignedEmails("");
    setEarlyCheckinMinutes(5);
    setOnTimeUntilMinutes(10);
    setCloseBeforeEndMinutes(5);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setConfirmOpen(true);
  }

  async function confirmCreate() {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/ships", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title,
          description,
          remark,
          start_at: new Date(startAt).toISOString(),
          end_at: new Date(endAt).toISOString(),
          assigned_emails: assignedEmails,
          early_checkin_minutes: earlyCheckinMinutes,
          on_time_until_minutes: onTimeUntilMinutes,
          close_before_end_minutes: closeBeforeEndMinutes
        })
      });

      const data = await readJsonResponse(response);

      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "สร้างรอบเช็กอินไม่สำเร็จ");
        return;
      }

      setResult(data as CreateResponse);
      resetForm();
      setConfirmOpen(false);
    } catch {
      setError("สร้างรอบเช็กอินไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  async function copyText(text: string, message: string) {
    await navigator.clipboard.writeText(text);
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2500);
  }

  async function openEmailPicker() {
    setEmailPickerOpen(true);
    setSelectedEmails([]);
    setEmailPickerError(null);

    if (emailOptions.length > 0) {
      return;
    }

    setEmailPickerLoading(true);
    try {
      const response = await fetch("/api/admin/users/emails");
      const data = await readJsonResponse(response);

      if (!response.ok) {
        setEmailPickerError(typeof data.error === "string" ? data.error : "โหลดรายชื่ออีเมลไม่สำเร็จ");
        return;
      }

      const emails = Array.isArray((data as EmailListResponse).emails) ? (data as EmailListResponse).emails : [];
      setEmailOptions(emails.filter((email) => typeof email === "string"));
    } catch {
      setEmailPickerError("โหลดรายชื่ออีเมลไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setEmailPickerLoading(false);
    }
  }

  function toggleSelectedEmail(email: string) {
    setSelectedEmails((current) =>
      current.includes(email) ? current.filter((item) => item !== email) : [...current, email]
    );
  }

  function confirmSelectedEmails() {
    const mergedEmails = parseEmailList(`${assignedEmails}\n${selectedEmails.join(",")}`);
    setAssignedEmails(mergedEmails.join(", "));
    setEmailPickerOpen(false);
    setSelectedEmails([]);
    setEmailSearch("");
  }

  return (
    <main className="min-h-dvh overflow-x-hidden">
      <header className="border-b bg-white px-[max(1rem,env(safe-area-inset-left))] py-3">
        <div className="container flex flex-col gap-3 px-0 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/admin/dashboard" className="flex min-w-0 items-center gap-2 font-bold">
            <Ship className="size-6 shrink-0 text-primary" />
            <span className="truncate">DockPass แอดมิน</span>
          </Link>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/dashboard">
              <ArrowLeft className="size-4" />
              กลับแดชบอร์ด
            </Link>
          </Button>
        </div>
      </header>

      <div className="container py-5 sm:py-8">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-balance text-2xl font-bold sm:text-3xl">สร้างรอบเช็กอินใหม่</h1>
            <p className="mt-1 text-pretty text-sm text-muted-foreground">
              กำหนดรายละเอียดรอบ เวลา และอีเมลผู้ได้รับมอบหมาย ผู้ใช้จะเข้าสู่ระบบด้วย Google เพื่อเช็กอิน
            </p>
          </div>
          {notice ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p> : null}
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          <Card>
            <CardHeader>
              <CardTitle>ข้อมูลรอบเช็กอิน</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={onSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="title">ชื่อรอบเช็กอิน</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={50}
                    placeholder="เช่น รอบส่งเอกสารสนามบิน"
                    required
                  />
                  <p className="text-sm text-muted-foreground tabular-nums">{title.length}/50 ตัวอักษร</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">รายละเอียด</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    maxLength={500}
                    placeholder="อธิบายงาน สถานที่ หรือสิ่งที่ผู้ได้รับมอบหมายต้องทราบ"
                    required
                  />
                  <p className="text-sm text-muted-foreground tabular-nums">{description.length}/500 ตัวอักษร</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="remark">หมายเหตุ</Label>
                  <Textarea
                    id="remark"
                    value={remark}
                    onChange={(event) => setRemark(event.target.value)}
                    maxLength={250}
                    placeholder="ไม่บังคับ"
                  />
                  <p className="text-sm text-muted-foreground tabular-nums">{remark.length}/250 ตัวอักษร</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="start_at">เวลาเริ่ม</Label>
                    <DateTimeDisplayInput
                      id="start_at"
                      value={startAt}
                      onChange={setStartAt}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_at">เวลาสิ้นสุด</Label>
                    <DateTimeDisplayInput
                      id="end_at"
                      value={endAt}
                      onChange={setEndAt}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Label htmlFor="assigned_emails">อีเมลผู้ได้รับมอบหมาย</Label>
                    <Button type="button" variant="outline" size="sm" onClick={openEmailPicker} className="w-full sm:w-auto">
                      <Users className="size-4" />
                      เลือกอีเมลที่มีอยู่ในระบบ
                    </Button>
                  </div>
                  <Textarea
                    id="assigned_emails"
                    value={assignedEmails}
                    onChange={(event) => setAssignedEmails(event.target.value)}
                    placeholder="somchai@example.com&#10;suda@example.com, team@example.com"
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    รองรับหนึ่งอีเมลต่อบรรทัด หรือคั่นด้วยเครื่องหมายจุลภาค ระบบจะตัดช่องว่าง แปลงเป็นตัวพิมพ์เล็ก และลบรายการซ้ำ
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="early">เช็กอินก่อนเริ่มได้ (นาที)</Label>
                    <Input
                      id="early"
                      type="number"
                      min={0}
                      max={1440}
                      value={earlyCheckinMinutes}
                      onChange={(event) => setEarlyCheckinMinutes(Number(event.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="on_time">ตรงเวลาถึง (นาที)</Label>
                    <Input
                      id="on_time"
                      type="number"
                      min={0}
                      max={1440}
                      value={onTimeUntilMinutes}
                      onChange={(event) => setOnTimeUntilMinutes(Number(event.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="close">ปิดก่อนจบ (นาที)</Label>
                    <Input
                      id="close"
                      type="number"
                      min={0}
                      max={1440}
                      value={closeBeforeEndMinutes}
                      onChange={(event) => setCloseBeforeEndMinutes(Number(event.target.value))}
                    />
                  </div>
                </div>

                {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

                <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={loading}>
                  <Check className="size-4" />
                  ตรวจสอบและยืนยัน
                </Button>
              </form>
            </CardContent>
          </Card>

          <aside className="space-y-5">
            <Card className="border-sky-100 bg-sky-50/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clipboard className="size-5 text-primary" />
                  พอร์ทัลผู้ใช้
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-pretty text-sm leading-7 text-muted-foreground">
                  ผู้ใช้จะเปิดพอร์ทัลกลางและเข้าสู่ระบบด้วย Google ระบบจะจับคู่จากอีเมลที่ได้รับมอบหมายโดยอัตโนมัติ
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarClock className="size-5 text-primary" />
                  สรุปก่อนสร้าง
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">เวลาเริ่ม</p>
                  <p className="font-semibold">{formatThaiDateTimeDisplay(startAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">เวลาสิ้นสุด</p>
                  <p className="font-semibold">{formatThaiDateTimeDisplay(endAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">ผู้ได้รับมอบหมาย</p>
                  <p className="font-semibold tabular-nums">{normalizedEmails.length} อีเมล</p>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(open) => !loading && setConfirmOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการสร้างรอบเช็กอิน</DialogTitle>
            <DialogDescription>
              ตรวจสอบรายละเอียดก่อนสร้างรอบ ระบบจะบันทึกผู้ได้รับมอบหมายและให้ผู้ใช้เข้าสู่ระบบด้วย Google เพื่อเช็กอิน
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border p-4">
              <p className="text-sm text-muted-foreground">ชื่อรอบ</p>
              <h2 className="safe-break mt-1 font-semibold">{title || "-"}</h2>
              <p className="safe-break mt-2 text-sm text-muted-foreground">{description || "-"}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md bg-muted p-3">
                <p className="text-sm text-muted-foreground">เวลาเริ่ม</p>
                <p className="text-sm font-semibold">{formatThaiDateTimeDisplay(startAt)}</p>
              </div>
              <div className="rounded-md bg-muted p-3">
                <p className="text-sm text-muted-foreground">เวลาสิ้นสุด</p>
                <p className="text-sm font-semibold">{formatThaiDateTimeDisplay(endAt)}</p>
              </div>
              <div className="rounded-md bg-muted p-3">
                <p className="text-sm text-muted-foreground">อีเมล</p>
                <p className="text-sm font-semibold tabular-nums">{normalizedEmails.length} รายการ</p>
              </div>
            </div>
            {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={loading}>
                ยกเลิก
              </Button>
              <Button onClick={confirmCreate} disabled={loading}>
                {loading ? "กำลังสร้าง..." : "ยืนยันการสร้าง"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(result)} onOpenChange={(open) => !open && setResult(null)}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="size-5" />
              </span>
              <div>
                <DialogTitle>สร้างรอบเช็กอินสำเร็จ</DialogTitle>
                <DialogDescription>ฟอร์มถูกล้างแล้ว คุณสามารถกลับแดชบอร์ดหรือสร้างรอบใหม่ได้ทันที</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {result ? (
            <div className="space-y-4">
              <div className="rounded-md border p-4">
                <p className="text-sm text-muted-foreground">ชื่อรอบ</p>
                <h2 className="safe-break mt-1 font-semibold">{result.ship.title}</h2>
                <p className="mt-3 text-sm text-muted-foreground tabular-nums">
                  ผู้ได้รับมอบหมาย {result.assigned_emails.length} อีเมล
                </p>
                <p className="mt-2 text-sm text-muted-foreground tabular-nums">
                  เวลา: {formatThaiDateRangeDisplay(result.ship.start_at, result.ship.end_at)}
                </p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => copyText(result.portal_link, "คัดลอกพอร์ทัลเช็กอินแล้ว")}>
                <Copy className="size-4" />
                คัดลอกพอร์ทัลเช็กอิน
              </Button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => setResult(null)}>
                  สร้างรอบใหม่
                </Button>
                <Button onClick={() => router.push("/admin/dashboard")}>
                  กลับไปแดชบอร์ด
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={emailPickerOpen} onOpenChange={setEmailPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เลือกอีเมลที่มีอยู่ในระบบ</DialogTitle>
            <DialogDescription>
              เลือกหลายอีเมลเพื่อเพิ่มเข้าไปในรายชื่อผู้ได้รับมอบหมาย ระบบจะรวมกับรายการที่พิมพ์ไว้และลบรายการซ้ำให้อัตโนมัติ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={emailSearch}
                onChange={(event) => setEmailSearch(event.target.value)}
                placeholder="ค้นหาอีเมล"
                className="pl-9"
              />
            </div>

            {emailPickerError ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{emailPickerError}</p> : null}

            <div className="max-h-80 overflow-y-auto rounded-md border">
              {emailPickerLoading ? (
                <div className="space-y-2 p-3">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="h-11 rounded-md bg-muted" />
                  ))}
                </div>
              ) : filteredEmailOptions.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">ไม่พบอีเมลในระบบ</p>
              ) : (
                <div className="divide-y">
                  {filteredEmailOptions.map((email) => (
                    <label key={email} className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/60">
                      <input
                        type="checkbox"
                        className="size-4 shrink-0 accent-primary"
                        checked={selectedEmails.includes(email)}
                        onChange={() => toggleSelectedEmail(email)}
                      />
                      <span className="min-w-0 break-all text-sm">{email}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground tabular-nums">เลือกแล้ว {selectedEmails.length} อีเมล</p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => setEmailPickerOpen(false)}>
                  ยกเลิก
                </Button>
                <Button onClick={confirmSelectedEmails} disabled={selectedEmails.length === 0}>
                  เพิ่มอีเมลที่เลือก
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
