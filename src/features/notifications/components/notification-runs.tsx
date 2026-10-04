import { EmptyState } from "@/components/data/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RunRow, SetupCheck } from "@/features/notifications/runs";
import { cn } from "@/lib/utils";
import { formatDateTimeVn } from "@/lib/format";

const KIND_LABEL: Record<RunRow["kind"], string> = {
  "expiry-alert": "Nhắc hạn chứng chỉ",
  "monthly-report": "Báo cáo tháng",
};

const HEAD = "h-8 bg-muted px-2.5 text-label uppercase text-muted-foreground";

/** Server Component: the history of automatic e-mails and whether the settings they need are present. */
export function NotificationRuns({ runs, checks }: { runs: RunRow[]; checks: SetupCheck[] }) {
  const missing = checks.filter((c) => !c.ok);
  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Lịch sử gửi email" className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-section-title">Lịch sử gửi email</h2>
          <p className="text-caption text-muted-foreground">Mỗi dòng là một kỳ gửi; số liệu đếm theo người nhận.</p>
        </div>
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table className="text-table tabular-nums">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={HEAD}>Loại</TableHead>
                <TableHead className={HEAD}>Kỳ</TableHead>
                <TableHead className={cn(HEAD, "text-right")}>Đã gửi</TableHead>
                <TableHead className={cn(HEAD, "text-right")}>Lỗi</TableHead>
                <TableHead className={cn(HEAD, "text-right")}>Đang gửi</TableHead>
                <TableHead className={HEAD}>Hoạt động cuối</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="whitespace-normal">
                    <EmptyState
                      title="Chưa gửi email nào"
                      description="Lịch: nhắc hạn 08:00 thứ Hai, báo cáo tháng 08:00 ngày 1 (giờ Việt Nam)."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                runs.map((run) => (
                  <TableRow key={`${run.kind}|${run.period}`} className="h-8 hover:bg-accent">
                    <TableCell className="px-2.5 py-1">{KIND_LABEL[run.kind]}</TableCell>
                    <TableCell className="px-2.5 py-1">{run.label}</TableCell>
                    <TableCell className="px-2.5 py-1 text-right">{run.sent}</TableCell>
                    <TableCell className={cn("px-2.5 py-1 text-right", run.failed > 0 && "font-semibold text-destructive")}>
                      {run.failed}
                    </TableCell>
                    <TableCell className="px-2.5 py-1 text-right">{run.pending}</TableCell>
                    <TableCell className="px-2.5 py-1">{formatDateTimeVn(run.lastActivityAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section aria-label="Cấu hình email" className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-section-title">Cấu hình</h2>
          <p className="text-caption text-muted-foreground">Chỉ hiển thị đã có hay chưa; giá trị không bao giờ được hiển thị.</p>
        </div>
        {missing.length > 0 && (
          <Alert variant="destructive">
            <AlertTitle>Email chưa gửi được ở production cho tới khi cấu hình đủ.</AlertTitle>
            <AlertDescription>Còn thiếu: {missing.map((c) => c.label).join(", ")}.</AlertDescription>
          </Alert>
        )}
        <ul className="flex flex-col divide-y overflow-hidden rounded-lg border bg-card text-body">
          {checks.map((check) => (
            <li key={check.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-table">{check.label}</span>
              <span className={check.ok ? "text-foreground" : "font-medium text-destructive"}>
                {check.ok ? "Đã cấu hình" : "Chưa cấu hình"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
