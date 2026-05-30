"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Copy,
  ExternalLink,
  Eye,
  LayoutDashboard,
  LogOut,
  Plus,
  Ship,
  Trash2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateDisplayInput } from "@/components/ui/date-display-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { safeBrowserSignOut } from "@/lib/auth/client-session";
import { getStatusBadgeVariant, getStatusThaiLabel, type CheckinStatus } from "@/lib/checkin-status";
import { formatThaiDateTimeDisplay, formatThaiDateRangeDisplay } from "@/lib/date-format";
import { createClientSupabaseClient } from "@/lib/supabase/client";

type ShipSummary = {
  id: string;
  title: string;
  description: string;
  remark: string | null;
  start_at: string;
  end_at: string;
  assigned_count: number;
  checked_in_count: number;
  not_checked_in_count: number;
  status_counts: {
    ON_TIME: number;
    LATE: number;
    OUT_OF_SHIP: number;
    TOO_EARLY: number;
  };
};

type DashboardResponse = {
  ships: ShipSummary[];
  summary: {
    assigned: number;
    checked_in: number;
    on_time: number;
    late: number;
    not_checked_in: number;
    out_of_ship: number;
    too_early: number;
  };
};

type ShipDetail = {
  ship: {
    id: string;
    title: string;
    description: string;
    remark: string | null;
    start_at: string;
    end_at: string;
    early_checkin_minutes: number;
    on_time_until_minutes: number;
    close_before_end_minutes: number;
  };
  assignees: {
    email: string;
    status: CheckinStatus;
    server_received_at: string | null;
    accuracy: number | null;
    google_maps_link: string | null;
  }[];
};

type TrashShip = {
  id: string;
  title: string;
  description: string;
  remark: string | null;
  start_at: string;
  end_at: string;
  assigned_count: number;
  checked_in_count: number;
  expired_at: string;
};

type TrashResponse = {
  server_time: string;
  ships: TrashShip[];
};

const emptyDashboard: DashboardResponse = {
  ships: [],
  summary: {
    assigned: 0,
    checked_in: 0,
    on_time: 0,
    late: 0,
    not_checked_in: 0,
    out_of_ship: 0,
    too_early: 0
  }
};

const emptyTrash: TrashResponse = {
  server_time: new Date(0).toISOString(),
  ships: []
};

const summaryCards = [
  ["จำนวนที่มอบหมาย", "assigned"],
  ["เช็กอินแล้ว", "checked_in"],
  ["ตรงเวลา", "on_time"],
  ["สาย", "late"],
  ["ยังไม่เช็กอิน", "not_checked_in"],
  ["นอกรอบ", "out_of_ship"]
] as const;

function formatExpiredDuration(endAt: string, serverTime: string) {
  const expiredMs = Math.max(new Date(serverTime).getTime() - new Date(endAt).getTime(), 0);
  const hours = Math.floor(expiredMs / (60 * 60 * 1000));
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} วัน ${hours % 24} ชั่วโมง`;
  }

  return `${hours} ชั่วโมง`;
}

async function readJsonResponse(response: Response) {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export default function AdminDashboardPage() {
  const supabase = useMemo(() => createClientSupabaseClient(), []);
  const [activeTab, setActiveTab] = useState<"list" | "trash">("list");
  const [filterMode, setFilterMode] = useState<"date" | "range">("date");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [assignedEmail, setAssignedEmail] = useState("");
  const [dashboard, setDashboard] = useState<DashboardResponse>(emptyDashboard);
  const [trash, setTrash] = useState<TrashResponse>(emptyTrash);
  const [loading, setLoading] = useState(true);
  const [trashLoading, setTrashLoading] = useState(false);
  const [cleaningTrash, setCleaningTrash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<ShipDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cleanConfirmOpen, setCleanConfirmOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (filterMode === "date" && date) {
      params.set("date", date);
    }
    if (filterMode === "range") {
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    }
    if (assignedEmail.trim()) {
      params.set("assignedEmail", assignedEmail.trim().toLowerCase());
    }

    try {
      const response = await fetch(`/api/ships?${params.toString()}`);
      const data = await readJsonResponse(response);

      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "โหลดข้อมูลไม่สำเร็จ");
        return;
      }

      setDashboard(data as DashboardResponse);
    } catch {
      setError("โหลดข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setLoading(false);
    }
  }, [assignedEmail, date, filterMode, from, to]);

  const loadTrash = useCallback(async () => {
    setTrashLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/trash");
      const data = await readJsonResponse(response);

      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "โหลดข้อมูลถังขยะไม่สำเร็จ");
        return;
      }

      setTrash(data as TrashResponse);
    } catch {
      setError("โหลดข้อมูลถังขยะไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setTrashLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (activeTab === "trash") {
      loadTrash();
    }
  }, [activeTab, loadTrash]);

  async function openDetail(shipId: string) {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const response = await fetch(`/api/ships/${shipId}`);
      const data = await readJsonResponse(response);
      if (response.ok) {
        setDetail(data as ShipDetail);
      } else {
        setError(typeof data.error === "string" ? data.error : "โหลดรายละเอียดไม่สำเร็จ");
      }
    } catch {
      setError("โหลดรายละเอียดไม่สำเร็จ");
    } finally {
      setDetailLoading(false);
    }
  }

  async function copyText(text: string, message: string) {
    await navigator.clipboard.writeText(text);
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2500);
  }

  async function signOut() {
    await safeBrowserSignOut(supabase);
    window.location.href = "/admin/login";
  }

  async function cleanTrash() {
    if (cleaningTrash) {
      return;
    }

    setCleaningTrash(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/trash/clean", {
        method: "POST"
      });
      const data = await readJsonResponse(response);

      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "ล้างข้อมูลถังขยะไม่สำเร็จ");
        return;
      }

      const deletedCount = typeof data.deletedCount === "number" ? data.deletedCount : 0;
      setNotice(`ล้างข้อมูลแล้ว ${deletedCount} รายการ`);
      setCleanConfirmOpen(false);
      await Promise.all([loadDashboard(), loadTrash()]);
    } catch {
      setError("ล้างข้อมูลถังขยะไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setCleaningTrash(false);
    }
  }

  return (
    <main className="min-h-dvh overflow-x-hidden">
      <header className="sticky top-0 z-30 border-b bg-white/95 px-[max(1rem,env(safe-area-inset-left))] py-3">
        <div className="container flex flex-col gap-3 px-0 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex min-w-0 items-center gap-2 font-bold text-slate-950">
            <Ship className="size-6 shrink-0 text-primary" />
            <span className="truncate">DockPass แอดมิน</span>
          </Link>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/ships/new">
                <Plus className="size-4" />
                สร้างรอบ
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="size-4" />
              ออกจากระบบ
            </Button>
          </div>
        </div>
      </header>

      <div className="container grid gap-5 py-5 lg:grid-cols-[240px_1fr] lg:py-8">
        <aside className="hidden rounded-lg border bg-white p-4 lg:block">
          <nav className="space-y-2">
            <button
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold ${activeTab === "list" ? "bg-secondary text-primary" : "text-slate-600 hover:bg-muted"}`}
              onClick={() => setActiveTab("list")}
              type="button"
            >
              <LayoutDashboard className="size-4" />
              รายการรอบเช็กอิน
            </button>
            <button
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold ${activeTab === "trash" ? "bg-secondary text-primary" : "text-slate-600 hover:bg-muted"}`}
              onClick={() => setActiveTab("trash")}
              type="button"
            >
              <Trash2 className="size-4" />
              ถังขยะ
            </button>
            <Link className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-muted" href="/admin/ships/new">
              <Plus className="size-4" />
              สร้างรอบ
            </Link>
          </nav>
        </aside>

        <section className="min-w-0 space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-balance text-2xl font-bold sm:text-3xl">แดชบอร์ดเช็กอิน</h1>
              <p className="mt-1 text-pretty text-sm text-muted-foreground">
                ดูสถานะรอบเช็กอินตามวันที่หรือช่วงวันที่ พร้อมรายละเอียดรายอีเมล เวลาแสดงตามประเทศไทย
              </p>
            </div>
            {notice ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-lg border bg-white p-1 lg:hidden">
            <button
              className={`min-h-11 rounded-md px-3 text-sm font-semibold ${activeTab === "list" ? "bg-secondary text-primary" : "text-muted-foreground"}`}
              onClick={() => setActiveTab("list")}
              type="button"
            >
              รายการรอบเช็กอิน
            </button>
            <button
              className={`min-h-11 rounded-md px-3 text-sm font-semibold ${activeTab === "trash" ? "bg-secondary text-primary" : "text-muted-foreground"}`}
              onClick={() => setActiveTab("trash")}
              type="button"
            >
              ถังขยะ
            </button>
          </div>

          {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

          {activeTab === "list" ? (
            <>
          <Card>
            <CardContent className="grid gap-4 pt-5 sm:pt-6">
              <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-end">
                <div className="flex rounded-md border bg-muted p-1">
                  <button
                    className={`min-h-10 min-w-32 flex-1 whitespace-nowrap rounded px-3 text-sm font-semibold ${filterMode === "date" ? "bg-white shadow-sm" : "text-muted-foreground"}`}
                    onClick={() => setFilterMode("date")}
                    type="button"
                  >
                    เลือกเฉพาะวัน
                  </button>
                  <button
                    className={`min-h-10 min-w-28 flex-1 whitespace-nowrap rounded px-3 text-sm font-semibold ${filterMode === "range" ? "bg-white shadow-sm" : "text-muted-foreground"}`}
                    onClick={() => setFilterMode("range")}
                    type="button"
                  >
                    ช่วงวันที่
                  </button>
                </div>
                {filterMode === "date" ? (
                  <div className="space-y-2">
                    <Label htmlFor="date">วันที่</Label>
                    <DateDisplayInput id="date" value={date} onChange={setDate} placeholder="dd/mm/yyyy" />
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="from">จากวันที่</Label>
                      <DateDisplayInput id="from" value={from} onChange={setFrom} placeholder="dd/mm/yyyy" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="to">ถึงวันที่</Label>
                      <DateDisplayInput id="to" value={to} onChange={setTo} placeholder="dd/mm/yyyy" />
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="assigned_email">ค้นหาผู้ได้รับมอบหมาย</Label>
                <Input
                  id="assigned_email"
                  type="email"
                  value={assignedEmail}
                  onChange={(event) => setAssignedEmail(event.target.value)}
                  placeholder="ค้นหาตามอีเมลผู้ถูกมอบหมาย"
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {summaryCards.map(([label, key]) => (
              <Card key={key}>
                <CardContent className="pt-5 sm:pt-6">
                  <p className="flex min-h-10 items-start text-sm leading-5 text-muted-foreground">{label}</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums">
                    {loading ? "..." : dashboard.summary[key]}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex min-w-0 items-center gap-2">
                  <CalendarDays className="size-5 shrink-0 text-primary" />
                  <span className="truncate">รายการรอบเช็กอิน</span>
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => copyText(`${window.location.origin}/check-in`, "คัดลอกพอร์ทัลเช็กอินแล้ว")}
                >
                  <Copy className="size-4" />
                  คัดลอกพอร์ทัล
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid gap-3">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="h-24 rounded-md bg-muted" />
                  ))}
                </div>
              ) : dashboard.ships.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center">
                  <p className="font-semibold">ยังไม่มีรอบเช็กอินในช่วงเวลานี้</p>
                  <p className="mt-1 text-sm text-muted-foreground">เริ่มจากสร้างรอบเช็กอินและเพิ่มอีเมลผู้ได้รับมอบหมาย</p>
                  <Button asChild className="mt-4">
                    <Link href="/admin/ships/new">สร้างรอบเช็กอิน</Link>
                  </Button>
                </div>
              ) : (
                <>
                  <div className="hidden overflow-x-auto md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-48 whitespace-nowrap">ชื่อรอบ</TableHead>
                          <TableHead className="min-w-56 whitespace-nowrap">เวลา</TableHead>
                          <TableHead className="min-w-24 whitespace-nowrap">เช็กอิน</TableHead>
                          <TableHead className="min-w-52 whitespace-nowrap">สถานะ</TableHead>
                          <TableHead className="min-w-24 whitespace-nowrap text-right">จัดการ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dashboard.ships.map((ship) => (
                          <TableRow key={ship.id}>
                            <TableCell className="safe-break font-semibold">{ship.title}</TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">{formatThaiDateRangeDisplay(ship.start_at, ship.end_at)}</TableCell>
                            <TableCell className="whitespace-nowrap tabular-nums">{ship.checked_in_count}/{ship.assigned_count}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1.5">
                                <Badge variant="green">ตรงเวลา {ship.status_counts.ON_TIME}</Badge>
                                <Badge variant="orange">สาย {ship.status_counts.LATE}</Badge>
                                <Badge variant="red">นอกรอบ {ship.status_counts.OUT_OF_SHIP}</Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => openDetail(ship.id)}>
                                  <Eye className="size-4" />
                                  ดู
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="grid gap-3 md:hidden">
                    {dashboard.ships.map((ship) => (
                      <div key={ship.id} className="rounded-lg border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="safe-break font-semibold">{ship.title}</h3>
                            <p className="mt-1 text-sm text-muted-foreground tabular-nums">{formatThaiDateTimeDisplay(ship.start_at)}</p>
                          </div>
                          <Badge variant="gray" className="shrink-0">{ship.checked_in_count}/{ship.assigned_count}</Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <Badge variant="green">ตรงเวลา {ship.status_counts.ON_TIME}</Badge>
                          <Badge variant="orange">สาย {ship.status_counts.LATE}</Badge>
                          <Badge variant="red">นอกรอบ {ship.status_counts.OUT_OF_SHIP}</Badge>
                        </div>
                        <div className="mt-4">
                          <Button variant="outline" onClick={() => openDetail(ship.id)}>
                            <Eye className="size-4" />
                            ดูรายละเอียด
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
            </>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Trash2 className="size-5 text-primary" />
                    ถังขยะ
                  </CardTitle>
                  <Button
                    variant="destructive"
                    onClick={() => setCleanConfirmOpen(true)}
                    disabled={trashLoading || cleaningTrash || trash.ships.length === 0}
                  >
                    <Trash2 className="size-4" />
                    {cleaningTrash ? "กำลังล้างข้อมูล..." : "ล้างข้อมูลทั้งหมด"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {trashLoading ? (
                  <div className="grid gap-3">
                    {[0, 1, 2].map((item) => (
                      <div key={item} className="h-28 rounded-md bg-muted" />
                    ))}
                  </div>
                ) : trash.ships.length === 0 ? (
                  <div className="rounded-md border border-dashed p-6 text-center">
                    <p className="font-semibold">ไม่มีข้อมูลในถังขยะ</p>
                    <p className="mx-auto mt-1 max-w-lg text-pretty text-sm text-muted-foreground">
                      รอบเช็กอินที่หมดอายุเกิน 72 ชั่วโมงหลังเข้าสู่ประวัติจะมาแสดงที่นี่ก่อนลบถาวร
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {trash.ships.map((ship) => (
                      <div key={ship.id} className="rounded-lg border bg-white p-4">
                        <h3 className="safe-break font-semibold">{ship.title}</h3>
                        <p className="line-clamp-2 mt-2 text-sm text-muted-foreground">{ship.description}</p>
                        <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                          <span>เริ่ม: {formatThaiDateTimeDisplay(ship.start_at)}</span>
                          <span>สิ้นสุด: {formatThaiDateTimeDisplay(ship.end_at)}</span>
                          <span className="tabular-nums">หมดอายุแล้ว: {formatExpiredDuration(ship.end_at, trash.server_time)}</span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Badge variant="gray">มอบหมาย {ship.assigned_count}</Badge>
                          <Badge variant="green">เช็กอิน {ship.checked_in_count}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </section>
      </div>

      <Dialog open={cleanConfirmOpen} onOpenChange={(open) => !cleaningTrash && setCleanConfirmOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการล้างข้อมูล</DialogTitle>
            <DialogDescription>
              การดำเนินการนี้จะลบรอบเช็กอินที่หมดอายุเกิน 72 ชั่วโมงทั้งหมดออกจากระบบถาวร และไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border bg-red-50 p-4 text-sm leading-6 text-red-700">
              รายการที่จะถูกลบถาวร: <span className="font-semibold tabular-nums">{trash.ships.length}</span> รอบเช็กอิน
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setCleanConfirmOpen(false)} disabled={cleaningTrash}>
                ยกเลิก
              </Button>
              <Button variant="destructive" onClick={cleanTrash} disabled={cleaningTrash || trash.ships.length === 0}>
                {cleaningTrash ? "กำลังลบ..." : "ยืนยันการลบทั้งหมด"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detail?.ship.title ?? "รายละเอียดรอบเช็กอิน"}</DialogTitle>
            <DialogDescription>
              รายละเอียดรอบเช็กอิน รายชื่อผู้ได้รับมอบหมาย และสถานะการเช็กอินรายอีเมล
            </DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="space-y-3">
              <div className="h-20 rounded-md bg-muted" />
              <div className="h-20 rounded-md bg-muted" />
            </div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="rounded-md border p-4">
                <p className="text-sm text-muted-foreground">รายละเอียด</p>
                <p className="safe-break mt-1 text-sm leading-6">{detail.ship.description}</p>
                {detail.ship.remark ? (
                  <p className="safe-break mt-3 rounded-md bg-muted p-3 text-sm leading-6 text-muted-foreground">
                    หมายเหตุ: {detail.ship.remark}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-3 rounded-md border p-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">เวลาเริ่ม</p>
                  <p className="font-semibold tabular-nums">{formatThaiDateTimeDisplay(detail.ship.start_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">เวลาสิ้นสุด</p>
                  <p className="font-semibold tabular-nums">{formatThaiDateTimeDisplay(detail.ship.end_at)}</p>
                </div>
              </div>
              <div className="grid gap-3">
                {detail.assignees.map((assignee) => (
                  <div key={assignee.email} className="rounded-md border p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="min-w-0 break-all font-semibold">{assignee.email}</p>
                      <Badge variant={getStatusBadgeVariant(assignee.status)}>
                        {getStatusThaiLabel(assignee.status)}
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                      <span>เวลา: {formatThaiDateTimeDisplay(assignee.server_received_at)}</span>
                      <span>ความแม่นยำ: {assignee.accuracy ? `${Math.round(assignee.accuracy)} ม.` : "-"}</span>
                      {assignee.google_maps_link ? (
                        <a className="inline-flex items-center gap-1 font-semibold text-primary" href={assignee.google_maps_link} target="_blank" rel="noreferrer">
                          เปิดใน Google Maps
                          <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        <span>แผนที่: -</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}
