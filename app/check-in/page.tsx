"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  History,
  LocateFixed,
  LogOut,
  MapPin,
  ShieldCheck
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { getStatusBadgeVariant, type CheckinStatus } from "@/lib/checkin-status";
import { createClientSupabaseClient } from "@/lib/supabase/client";

type PortalShip = {
  id: string;
  title: string;
  description: string;
  remark: string | null;
  start_at: string;
  end_at: string;
  status: CheckinStatus;
  status_label: string;
  expected_checkin_status: Exclude<CheckinStatus, "NOT_CHECKED_IN"> | null;
  expected_checkin_status_label: string | null;
  checked_in_at: string | null;
  accuracy: number | null;
  google_maps_link: string | null;
  can_check_in: boolean;
  disabled_reason: string | null;
  is_history: boolean;
  is_today: boolean;
  checkin_open_at: string;
};

type CheckinResult = {
  ship?: {
    id: string;
    title: string;
  };
  status: Exclude<CheckinStatus, "NOT_CHECKED_IN">;
  status_label: string;
  timestamp: string;
  accuracy: number | null;
  google_maps_link: string | null;
};

type TabKey = "calendar" | "checkin" | "history";

const tabs: { key: TabKey; label: string; icon: typeof CalendarDays }[] = [
  { key: "calendar", label: "ปฏิทิน", icon: CalendarDays },
  { key: "checkin", label: "เช็กอิน", icon: LocateFixed },
  { key: "history", label: "ประวัติ", icon: History }
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeZone: "Asia/Bangkok"
  }).format(new Date(value));
}

function formatTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok"
  }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok"
  }).format(new Date(value));
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    });
  });
}

function getPositionErrorMessage(error: unknown) {
  if (!("geolocation" in navigator)) {
    return "เบราว์เซอร์นี้ไม่รองรับการอ่านตำแหน่ง";
  }

  if (!window.isSecureContext) {
    return "การอ่านตำแหน่งต้องเปิดผ่าน HTTPS หรือ localhost";
  }

  if (typeof error === "object" && error !== null && "code" in error) {
    const code = Number((error as GeolocationPositionError).code);
    if (code === 1) {
      return "ไม่สามารถเข้าถึงตำแหน่งได้ กรุณาอนุญาตการเข้าถึงตำแหน่งแล้วลองอีกครั้ง";
    }
    if (code === 3) {
      return "อ่านตำแหน่งไม่ทันเวลา กรุณาลองเช็กอินอีกครั้ง";
    }
  }

  return "ไม่สามารถอ่านตำแหน่งได้ กรุณาลองอีกครั้ง";
}

async function readJsonResponse(response: Response) {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export default function CheckInPage() {
  const supabase = useMemo(() => createClientSupabaseClient(), []);
  const [activeTab, setActiveTab] = useState<TabKey>("calendar");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [ships, setShips] = useState<PortalShip[]>([]);
  const [loadingShips, setLoadingShips] = useState(false);
  const [selectedShipId, setSelectedShipId] = useState("");
  const [detailShip, setDetailShip] = useState<PortalShip | null>(null);
  const [confirmShip, setConfirmShip] = useState<PortalShip | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckinResult | null>(null);

  const todayShips = useMemo(() => ships.filter((ship) => ship.is_today), [ships]);
  const checkinShips = useMemo(
    () =>
      ships
        .filter((ship) => !ship.is_history && ship.status === "NOT_CHECKED_IN")
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()),
    [ships]
  );
  const historyShips = useMemo(
    () =>
      ships
        .filter((ship) => ship.is_history)
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()),
    [ships]
  );
  const selectedShip = checkinShips.find((ship) => ship.id === selectedShipId) ?? null;

  async function loadShips() {
    setLoadingShips(true);
    setError(null);

    try {
      const response = await fetch("/api/user/ships");
      const data = await readJsonResponse(response);

      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "โหลดรายการรอบเช็กอินไม่สำเร็จ");
        if (response.status === 401) {
          setUserEmail(null);
        }
        return;
      }

      const nextShips = Array.isArray(data.ships) ? (data.ships as PortalShip[]) : [];
      setShips(nextShips);
      setSelectedShipId((current) => {
        if (nextShips.some((ship) => ship.id === current && ship.can_check_in)) {
          return current;
        }

        return nextShips.find((ship) => ship.can_check_in && !ship.is_history)?.id ?? "";
      });
    } catch {
      setError("โหลดรายการรอบเช็กอินไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setLoadingShips(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadUser() {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!active) {
        return;
      }

      setUserEmail(user?.email ?? null);
      setAuthLoading(false);
      if (user?.email) {
        await loadShips();
      }
    }

    loadUser();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null);
      if (session?.user.email) {
        loadShips();
      } else {
        setShips([]);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function signInWithGoogle() {
    setError(null);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/check-in`
      }
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUserEmail(null);
    setShips([]);
    setResult(null);
  }

  async function submitCheckIn() {
    if (!confirmShip || checkingIn) {
      return;
    }

    setError(null);
    setResult(null);
    setCheckingIn(true);

    let position: GeolocationPosition;
    try {
      position = await getCurrentPosition();
    } catch (positionError) {
      setError(getPositionErrorMessage(positionError));
      setCheckingIn(false);
      return;
    }

    try {
      const response = await fetch("/api/user/check-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ship_id: confirmShip.id,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          client_captured_at: new Date(position.timestamp).toISOString()
        })
      });
      const data = await readJsonResponse(response);

      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "เช็กอินไม่สำเร็จ");
        if (data.status) {
          setResult(data as CheckinResult);
        }
        return;
      }

      setResult(data as CheckinResult);
      setConfirmShip(null);
      await loadShips();
    } catch {
      setError("เช็กอินไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setCheckingIn(false);
    }
  }

  if (authLoading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-sm text-muted-foreground">กำลังตรวจสอบสถานะเข้าสู่ระบบ...</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!userEmail) {
    return (
      <main className="flex min-h-dvh items-center justify-center overflow-x-hidden bg-slate-50 px-4 py-8">
        <div className="w-full max-w-md">
          <Card className="shadow-soft">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <LocateFixed className="size-6" />
              </div>
              <CardTitle className="text-2xl">พอร์ทัลเช็กอิน DockPass</CardTitle>
              <p className="text-pretty text-sm text-muted-foreground">
                เข้าสู่ระบบด้วย Google เพื่อดูรอบเช็กอินที่ได้รับมอบหมายจากอีเมลของคุณ
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
              <Button className="w-full" size="lg" onClick={signInWithGoogle}>
                เข้าสู่ระบบด้วย Google
              </Button>
              <p className="text-pretty text-center text-xs leading-5 text-muted-foreground">
                ระบบจะใช้เฉพาะอีเมลจากบัญชีที่เข้าสู่ระบบเพื่อตรวจสอบสิทธิ์รอบเช็กอิน
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh overflow-x-hidden bg-slate-50">
      <header className="sticky top-0 z-30 border-b bg-white/95 px-[max(1rem,env(safe-area-inset-left))] py-3">
        <div className="container flex flex-col gap-3 px-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-balance text-xl font-bold text-slate-950 sm:text-2xl">พอร์ทัลเช็กอิน</h1>
            <p className="safe-break text-sm text-muted-foreground">{userEmail}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="size-4" />
            ออกจากระบบ
          </Button>
        </div>
      </header>

      <div className="container space-y-5 py-5 sm:py-8">
        <div className="grid grid-cols-3 gap-2 rounded-lg border bg-white p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                className={`min-h-11 rounded-md px-2 text-sm font-semibold ${activeTab === tab.key ? "bg-secondary text-primary" : "text-muted-foreground"}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <span className="inline-flex items-center justify-center gap-1.5">
                  <Icon className="size-4" />
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        {result ? (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="flex items-start gap-3 pt-5 sm:pt-6">
              <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-600" />
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-emerald-900">เช็กอินสำเร็จ</h2>
                <p className="safe-break mt-1 text-sm text-emerald-800">{result.ship?.title}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant={getStatusBadgeVariant(result.status)}>{result.status_label}</Badge>
                  <span className="text-sm text-emerald-800">{formatDateTime(result.timestamp)}</span>
                </div>
                {result.google_maps_link ? (
                  <Button asChild className="mt-4 w-full sm:w-auto" variant="outline">
                    <a href={result.google_maps_link} target="_blank" rel="noreferrer">
                      เปิดใน Google Maps
                      <ExternalLink className="size-4" />
                    </a>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {activeTab === "calendar" ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="size-5 text-primary" />
                ปฏิทินวันนี้
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingShips ? (
                <div className="grid gap-3">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="h-24 rounded-md bg-muted" />
                  ))}
                </div>
              ) : todayShips.length === 0 ? (
                <EmptyState title="ยังไม่มีรอบเช็กอินวันนี้" description="เมื่อแอดมินมอบหมายรอบเช็กอินให้คุณ รายการของวันนี้จะแสดงที่นี่" />
              ) : (
                <div className="grid gap-3">
                  {todayShips.map((ship) => (
                    <button
                      key={ship.id}
                      type="button"
                      className="grid rounded-lg border bg-white p-4 text-left hover:bg-muted/50 md:grid-cols-[120px_1fr_auto] md:items-center"
                      onClick={() => setDetailShip(ship)}
                    >
                      <div className="text-sm font-semibold tabular-nums text-primary">
                        {formatTime(ship.start_at)} - {formatTime(ship.end_at)}
                      </div>
                      <div className="min-w-0 py-3 md:py-0">
                        <h3 className="safe-break font-semibold">{ship.title}</h3>
                        <p className="line-clamp-2 text-sm text-muted-foreground">{ship.description}</p>
                      </div>
                      <Badge variant={getStatusBadgeVariant(ship.status)}>{ship.status_label}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {activeTab === "checkin" ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LocateFixed className="size-5 text-primary" />
                เช็กอิน
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingShips ? (
                <div className="grid gap-3">
                  {[0, 1].map((item) => (
                    <div key={item} className="h-28 rounded-md bg-muted" />
                  ))}
                </div>
              ) : checkinShips.length === 0 ? (
                <EmptyState title="ไม่มีรอบที่ต้องเช็กอิน" description="รอบที่เช็กอินแล้วหรือเข้าสู่ประวัติจะไม่แสดงในรายการเลือกเช็กอิน" />
              ) : (
                <div className="grid gap-3">
                  {checkinShips.map((ship) => (
                    <label
                      key={ship.id}
                      className={`block rounded-lg border bg-white p-4 ${ship.can_check_in ? "cursor-pointer hover:bg-muted/50" : "opacity-70"}`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          className="mt-1 size-4"
                          type="radio"
                          name="ship"
                          value={ship.id}
                          checked={selectedShipId === ship.id}
                          disabled={!ship.can_check_in || checkingIn}
                          onChange={() => setSelectedShipId(ship.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <h3 className="safe-break font-semibold">{ship.title}</h3>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {formatDate(ship.start_at)} เวลา {formatTime(ship.start_at)} - {formatTime(ship.end_at)}
                              </p>
                            </div>
                            <Badge variant={ship.can_check_in ? "green" : "blue"}>
                              {ship.can_check_in ? "พร้อมเช็กอิน" : ship.disabled_reason ?? "ยังไม่พร้อม"}
                            </Badge>
                          </div>
                          <p className="safe-break mt-2 text-sm text-muted-foreground">{ship.description}</p>
                          {ship.expected_checkin_status === "OUT_OF_SHIP" ? (
                            <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                              เช็กอินได้ แต่จะถูกบันทึกเป็นนอกรอบ
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              <div className="rounded-md border bg-white p-4 text-sm leading-6 text-muted-foreground">
                ระบบจะบันทึกตำแหน่งปัจจุบันของคุณเมื่อกดเช็กอินเท่านั้น ระบบจะไม่ติดตามตำแหน่งแบบต่อเนื่องหรือเบื้องหลัง
              </div>

              <Button
                size="lg"
                className="w-full sm:w-auto"
                disabled={!selectedShip || !selectedShip.can_check_in || checkingIn}
                onClick={() => selectedShip && setConfirmShip(selectedShip)}
              >
                <MapPin className="size-4" />
                เช็กอินตอนนี้
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {activeTab === "history" ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-5 text-primary" />
                ประวัติ
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historyShips.length === 0 ? (
                <EmptyState title="ยังไม่มีประวัติ" description="รอบจะเข้าสู่ประวัติหลังเวลาสิ้นสุด 1 ชั่วโมง และแสดงต่ออีก 72 ชั่วโมง" />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {historyShips.map((ship) => (
                    <button
                      key={ship.id}
                      type="button"
                      className="rounded-lg border bg-white p-4 text-left hover:bg-muted/50"
                      onClick={() => setDetailShip(ship)}
                    >
                      <h3 className="safe-break font-semibold">{ship.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {formatDate(ship.start_at)} เวลา {formatTime(ship.start_at)} - {formatTime(ship.end_at)}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant={getStatusBadgeVariant(ship.status)}>
                          {ship.status === "NOT_CHECKED_IN" ? "ไม่ได้เช็กอิน" : ship.status_label}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        <div className="flex items-start gap-3 rounded-lg border bg-white p-4 text-sm leading-6 text-slate-600">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <p className="text-pretty">
            DockPass ใช้อีเมลจากบัญชี Google ที่เข้าสู่ระบบและเวลาจากเซิร์ฟเวอร์เพื่อคำนวณสถานะเช็กอิน
          </p>
        </div>
      </div>

      <Dialog open={Boolean(detailShip)} onOpenChange={(open) => !open && setDetailShip(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detailShip?.title ?? "รายละเอียดรอบเช็กอิน"}</DialogTitle>
            <DialogDescription>รายละเอียดรอบเช็กอินและสถานะล่าสุดของคุณ</DialogDescription>
          </DialogHeader>
          {detailShip ? (
            <div className="space-y-4">
              <div className="rounded-md border p-4">
                <p className="safe-break text-sm leading-6">{detailShip.description}</p>
                {detailShip.remark ? (
                  <p className="safe-break mt-3 rounded-md bg-muted p-3 text-sm text-muted-foreground">
                    หมายเหตุ: {detailShip.remark}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoBlock label="วันที่" value={formatDate(detailShip.start_at)} />
                <InfoBlock label="เวลา" value={`${formatTime(detailShip.start_at)} - ${formatTime(detailShip.end_at)}`} />
                <InfoBlock label="สถานะ" value={detailShip.status === "NOT_CHECKED_IN" ? "ยังไม่เช็กอิน" : detailShip.status_label} />
                <InfoBlock label="เช็กอินได้" value={detailShip.can_check_in ? "พร้อมเช็กอิน" : detailShip.disabled_reason ?? "ยังไม่พร้อม"} />
              </div>
              {detailShip.google_maps_link ? (
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <a href={detailShip.google_maps_link} target="_blank" rel="noreferrer">
                    เปิดใน Google Maps
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(confirmShip)} onOpenChange={(open) => !checkingIn && !open && setConfirmShip(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการเช็กอิน</DialogTitle>
            <DialogDescription>
              ระบบจะบันทึกตำแหน่งปัจจุบันของคุณเมื่อกดยืนยันเช็กอิน
            </DialogDescription>
          </DialogHeader>
          {confirmShip ? (
            <div className="space-y-4">
              <div className="rounded-md border p-4">
                <h2 className="safe-break font-semibold">{confirmShip.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatDate(confirmShip.start_at)} เวลา {formatTime(confirmShip.start_at)} - {formatTime(confirmShip.end_at)}
                </p>
                {confirmShip.expected_checkin_status === "OUT_OF_SHIP" ? (
                  <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                    เช็กอินได้ แต่จะถูกบันทึกเป็นนอกรอบ
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => setConfirmShip(null)} disabled={checkingIn}>
                  ยกเลิก
                </Button>
                <Button onClick={submitCheckIn} disabled={checkingIn}>
                  {checkingIn ? "กำลังเช็กอิน..." : "ยืนยันการเช็กอิน"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-md border border-dashed bg-white p-6 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-lg text-pretty text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="safe-break text-sm font-semibold">{value}</p>
    </div>
  );
}
