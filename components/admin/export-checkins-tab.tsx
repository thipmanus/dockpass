"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, FileDown } from "lucide-react";
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
import { getStatusBadgeVariant } from "@/lib/checkin-status";
import { formatDateDDMMYYYY, formatThaiDateRangeDisplay, formatThaiDateTimeDisplay } from "@/lib/date-format";
import {
  createCheckinCsv,
  EXPORT_RANGE_PRESETS,
  getLatestDateRange,
  validateExportDateRange,
  type ExportCheckinRecord
} from "@/lib/export-checkins";

type ExportResponse = {
  records: ExportCheckinRecord[];
};

async function readJsonResponse(response: Response) {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function getSelectedRecords(records: ExportCheckinRecord[], selectedIds: Set<string>) {
  return records.filter((record) => selectedIds.has(record.id));
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

export function ExportCheckinsTab() {
  const defaultRange = useMemo(() => getLatestDateRange(7), []);
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [appliedRange, setAppliedRange] = useState(defaultRange);
  const [records, setRecords] = useState<ExportCheckinRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [downloadConfirmOpen, setDownloadConfirmOpen] = useState(false);
  const [downloadedFileName, setDownloadedFileName] = useState<string | null>(null);

  const selectedRecords = useMemo(() => getSelectedRecords(records, selectedIds), [records, selectedIds]);
  const allSelected = records.length > 0 && selectedIds.size === records.length;
  const hasPendingFilter = startDate !== appliedRange.startDate || endDate !== appliedRange.endDate;
  const exportFileName = `dockpass-checkin-export-${appliedRange.startDate}-to-${appliedRange.endDate}.csv`;

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDownloadedFileName(null);

    try {
      const params = new URLSearchParams({
        startDate: appliedRange.startDate,
        endDate: appliedRange.endDate
      });
      const response = await fetch(`/api/admin/export/checkins?${params.toString()}`);
      const data = await readJsonResponse(response);

      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "โหลดข้อมูลส่งออกไม่สำเร็จ");
        setRecords([]);
        setSelectedIds(new Set());
        return;
      }

      const nextRecords = ((data as ExportResponse).records ?? []) as ExportCheckinRecord[];
      setRecords(nextRecords);
      setSelectedIds(new Set(nextRecords.map((record) => record.id)));
    } catch {
      setError("โหลดข้อมูลส่งออกไม่สำเร็จ กรุณาลองอีกครั้ง");
      setRecords([]);
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [appliedRange.endDate, appliedRange.startDate]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  function applyPreset(days: (typeof EXPORT_RANGE_PRESETS)[number]) {
    const range = getLatestDateRange(days);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    setFilterError(null);
    setDownloadedFileName(null);
  }

  function applyFilter() {
    const validation = validateExportDateRange(startDate, endDate);
    if (!validation.ok) {
      setFilterError(validation.error);
      return;
    }

    setFilterError(null);
    setDownloadedFileName(null);
    setAppliedRange({ startDate, endDate });
  }

  function toggleSelectAll() {
    setDownloadedFileName(null);
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }

    setSelectedIds(new Set(records.map((record) => record.id)));
  }

  function toggleRecord(recordId: string) {
    setDownloadedFileName(null);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
      }
      return next;
    });
  }

  function handleDownload() {
    if (selectedRecords.length === 0) {
      return;
    }

    downloadCsv(exportFileName, createCheckinCsv(selectedRecords));
    setDownloadedFileName(exportFileName);
    setDownloadConfirmOpen(false);
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown className="size-5 text-primary" />
            ส่งออกข้อมูล
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {EXPORT_RANGE_PRESETS.map((days) => (
              <Button key={days} type="button" variant="outline" size="sm" onClick={() => applyPreset(days)}>
                {days} วันล่าสุด
              </Button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="export_start_date">วันที่เริ่มต้น</Label>
              <DateDisplayInput id="export_start_date" value={startDate} onChange={setStartDate} placeholder="dd/mm/yyyy" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="export_end_date">วันที่สิ้นสุด</Label>
              <DateDisplayInput id="export_end_date" value={endDate} onChange={setEndDate} placeholder="dd/mm/yyyy" />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              <p>
                ช่วงวันที่ที่ใช้อยู่: {formatDateDDMMYYYY(appliedRange.startDate)} ถึง {formatDateDDMMYYYY(appliedRange.endDate)}
              </p>
              {hasPendingFilter ? <p className="text-amber-700">มีการเปลี่ยนตัวกรองที่ยังไม่ได้ใช้</p> : null}
            </div>
            <Button type="button" onClick={applyFilter} disabled={loading || !hasPendingFilter}>
              ใช้ตัวกรอง
            </Button>
          </div>
          {filterError ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{filterError}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>ตัวอย่างข้อมูลส่งออก</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">เลือกแล้ว {selectedRecords.length} รายการ</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={toggleSelectAll} disabled={records.length === 0 || loading}>
                {allSelected ? "ยกเลิกเลือกทั้งหมด" : "เลือกทั้งหมด"}
              </Button>
              <Button
                type="button"
                onClick={() => setDownloadConfirmOpen(true)}
                disabled={selectedRecords.length === 0 || loading}
              >
                <Download className="size-4" />
                ดาวน์โหลด CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          {downloadedFileName ? (
            <p className="mb-4 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
              ดาวน์โหลดเรียบร้อย: <span className="break-all">{downloadedFileName}</span>
            </p>
          ) : null}
          {!loading && records.length > 0 && selectedRecords.length === 0 ? (
            <p className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">กรุณาเลือกรายการอย่างน้อย 1 รายการ</p>
          ) : null}

          {loading ? (
            <div className="grid gap-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-24 rounded-md bg-muted" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center">
              <p className="font-semibold">ไม่พบข้อมูลสำหรับช่วงวันที่ที่เลือก</p>
              <p className="mt-1 text-sm text-muted-foreground">ลองเลือกช่วงวันที่อื่น หรือสร้างรอบเช็กอินก่อนส่งออกข้อมูล</p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Input
                          type="checkbox"
                          checked={allSelected}
                          aria-label="เลือกทั้งหมด"
                          onChange={toggleSelectAll}
                          className="size-4"
                        />
                      </TableHead>
                      <TableHead className="min-w-56 whitespace-nowrap">ช่วงเวลา</TableHead>
                      <TableHead className="min-w-64 whitespace-nowrap">ผู้ได้รับมอบหมาย</TableHead>
                      <TableHead className="min-w-32 whitespace-nowrap">สถานะ</TableHead>
                      <TableHead className="min-w-40 whitespace-nowrap">เวลาเช็กอิน</TableHead>
                      <TableHead className="min-w-48 whitespace-nowrap">ชื่อรอบ</TableHead>
                      <TableHead className="min-w-64 whitespace-nowrap">รายละเอียด</TableHead>
                      <TableHead className="min-w-28 whitespace-nowrap">แผนที่</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <Input
                            type="checkbox"
                            checked={selectedIds.has(record.id)}
                            aria-label={`เลือกรายการ ${record.assigneeEmail}`}
                            onChange={() => toggleRecord(record.id)}
                            className="size-4"
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                          {formatThaiDateRangeDisplay(record.startAt, record.endAt)}
                        </TableCell>
                        <TableCell className="break-all font-medium">{record.assigneeEmail}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(record.status)}>{record.statusLabelTh}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                          {record.checkedInAt ? formatThaiDateTimeDisplay(record.checkedInAt) : "-"}
                        </TableCell>
                        <TableCell className="safe-break font-medium">{record.title}</TableCell>
                        <TableCell>
                          <p className="line-clamp-2 max-w-80 text-sm text-muted-foreground">{record.description}</p>
                        </TableCell>
                        <TableCell>
                          {record.mapLink ? (
                            <a className="inline-flex items-center gap-1 font-semibold text-primary" href={record.mapLink} target="_blank" rel="noreferrer">
                              เปิดแผนที่
                              <ExternalLink className="size-3" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-3 lg:hidden">
                {records.map((record) => (
                  <div key={record.id} className="rounded-lg border p-4">
                    <div className="flex items-start gap-3">
                      <Input
                        type="checkbox"
                        checked={selectedIds.has(record.id)}
                        aria-label={`เลือกรายการ ${record.assigneeEmail}`}
                        onChange={() => toggleRecord(record.id)}
                        className="mt-1 size-4 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={getStatusBadgeVariant(record.status)}>{record.statusLabelTh}</Badge>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {record.checkedInAt ? formatThaiDateTimeDisplay(record.checkedInAt) : "-"}
                          </span>
                        </div>
                        <h3 className="safe-break mt-2 font-semibold">{record.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground tabular-nums">{formatThaiDateRangeDisplay(record.startAt, record.endAt)}</p>
                        <p className="mt-2 break-all text-sm font-medium">{record.assigneeEmail}</p>
                        <p className="safe-break mt-2 line-clamp-3 text-sm text-muted-foreground">{record.description}</p>
                        {record.mapLink ? (
                          <a className="mt-3 inline-flex items-center gap-1 font-semibold text-primary" href={record.mapLink} target="_blank" rel="noreferrer">
                            เปิดแผนที่
                            <ExternalLink className="size-3" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={downloadConfirmOpen} onOpenChange={setDownloadConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการดาวน์โหลด CSV</DialogTitle>
            <DialogDescription>
              ระบบจะดาวน์โหลดเฉพาะรายการที่เลือกอยู่ในตัวอย่างข้อมูลส่งออก
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border p-4 text-sm leading-6">
              <p>
                จำนวนรายการ: <span className="font-semibold tabular-nums">{selectedRecords.length}</span> รายการ
              </p>
              <p>
                ช่วงวันที่: {formatDateDDMMYYYY(appliedRange.startDate)} ถึง {formatDateDDMMYYYY(appliedRange.endDate)}
              </p>
              <p className="break-all">
                ชื่อไฟล์: <span className="font-semibold">{exportFileName}</span>
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setDownloadConfirmOpen(false)}>
                ยกเลิก
              </Button>
              <Button type="button" onClick={handleDownload} disabled={selectedRecords.length === 0}>
                <Download className="size-4" />
                ยืนยันดาวน์โหลด
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
