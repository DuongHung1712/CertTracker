import { notFound } from "next/navigation";
import { Logo } from "@/components/app-shell/logo";
import { PageHeader } from "@/components/app-shell/page-header";
import { EXPIRY_STATUSES } from "@/components/status/expiry";
import { ExpiryBadge } from "@/components/status/expiry-badge";
import { MemberCode } from "@/components/status/member-code";
import { ProgressInline } from "@/components/status/progress-inline";
import { RecordStatusLabel } from "@/components/status/record-status";
import { RoleBadge } from "@/components/status/role-badge";
import { KpiTile } from "@/components/data/kpi-tile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BreakdownDemo, ChartDemo, ComboboxDemo, ConfirmDemo, LoadingTableDemo, TableDemo, ToastDemo } from "./demos";

const COLOR_TOKENS = [
  "background", "card", "foreground", "muted", "muted-foreground", "primary",
  "primary-hover", "accent", "destructive", "border", "input", "ring",
];

const TEXT_STYLES = [
  ["text-page-title", "Tiêu đề trang · 20/28"],
  ["text-section-title", "Tiêu đề khối · 15/22"],
  ["text-body", "Nội dung · 14/20"],
  ["text-table", "Ô bảng · 13/18"],
  ["text-label uppercase", "Nhãn cột · 12/16"],
  ["text-caption", "Chú thích · 12/16"],
  ["text-kpi tabular-nums", "1.248"],
] as const;

const SAMPLE_DAYS: Record<(typeof EXPIRY_STATUSES)[number], [number | null, string | null]> = {
  Active: [400, "2027-10-31"],
  "Expiring in 60d": [48, "2026-11-13"],
  "Expiring Soon": [23, "2026-10-19"],
  Expired: [-5, "2026-09-21"],
  "No Expiry": [null, null],
  "N/A": [null, null],
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-section-title">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6">
      <PageHeader title="Design system" description="Trang trưng bày token và component. Chỉ có ở môi trường dev." />

      <Section title="Logo & Favicon">
        <div className="flex flex-wrap items-center gap-6 rounded-lg border bg-card p-4">
          <div className="flex flex-col items-center gap-1.5">
            <Logo size={16} />
            <span className="font-mono text-caption text-muted-foreground">16px (Tab)</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <Logo size={24} />
            <span className="font-mono text-caption text-muted-foreground">24px</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <Logo size={32} />
            <span className="font-mono text-caption text-muted-foreground">32px (Favicon)</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <Logo size={48} />
            <span className="font-mono text-caption text-muted-foreground">48px</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <Logo size={64} />
            <span className="font-mono text-caption text-muted-foreground">64px</span>
          </div>
          <div className="flex flex-col items-center gap-1.5 pl-4 border-l">
            <Logo size={28} showText />
            <span className="font-mono text-caption text-muted-foreground">Full Wordmark</span>
          </div>
          <div className="flex flex-col items-center gap-1.5 pl-4 border-l">
            <Logo size={28} variant="monogram" showText />
            <span className="font-mono text-caption text-muted-foreground">Monogram Variant</span>
          </div>
        </div>
      </Section>

      <Section title="Màu">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {COLOR_TOKENS.map((name) => (
            <div key={name} className="flex flex-col gap-1">
              <div className="h-12 rounded-lg border" style={{ background: `var(--${name})` }} />
              <span className="font-mono text-caption text-muted-foreground">{name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Chữ">
        <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
          {TEXT_STYLES.map(([className, sample]) => (
            <p key={className} className={className}>
              {sample}
            </p>
          ))}
        </div>
      </Section>

      <Section title="Trạng thái hết hạn">
        <div className="flex flex-wrap gap-2">
          {EXPIRY_STATUSES.map((status) => (
            <ExpiryBadge
              key={status}
              status={status}
              daysToExpiry={SAMPLE_DAYS[status][0]}
              expiryDate={SAMPLE_DAYS[status][1]}
            />
          ))}
        </div>
      </Section>

      <Section title="Trạng thái học, tiến độ, vai trò">
        <div className="flex flex-wrap items-center gap-6">
          <RecordStatusLabel status="done" />
          <RecordStatusLabel status="in_progress" />
          <RecordStatusLabel status="not_started" />
          <ProgressInline value={40} />
          <RoleBadge role="admin" />
          <RoleBadge role="manager" />
          <RoleBadge role="member" />
          <MemberCode code="M001" />
        </div>
      </Section>

      <Section title="Nút">
        <div className="flex flex-wrap gap-2">
          <Button>Thêm thành viên</Button>
          <Button variant="secondary">Xuất Excel</Button>
          <Button variant="outline">Hủy</Button>
          <Button variant="ghost">Xóa lọc</Button>
          <Button variant="destructive">Xóa khóa học</Button>
          <Button disabled>Đang lưu…</Button>
        </div>
      </Section>

      <Section title="Form">
        <div className="flex max-w-md flex-col gap-2">
          <Label htmlFor="design-email">Email</Label>
          <Input id="design-email" type="email" placeholder="ten@congty.com" />
          <p className="text-caption text-muted-foreground">Dùng email công ty.</p>
        </div>
      </Section>

      <Section title="Chọn có tìm kiếm">
        <ComboboxDemo />
      </Section>

      <Section title="Bảng">
        <TableDemo />
      </Section>

      <Section title="Dashboard: KPI">
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile label="Thành viên" value={1248} />
          <KpiTile label="Chứng chỉ còn hiệu lực" value={86} hint="trong đó 3 sắp hết hạn" />
          <KpiTile label="Tỉ lệ hoàn thành" value="75%" />
          <KpiTile label="Đã hết hạn" value={0} />
        </dl>
      </Section>

      <Section title="Dashboard: biểu đồ hạn (có dữ liệu, rồi toàn số 0)">
        <ChartDemo />
      </Section>

      <Section title="Dashboard: bảng thống kê và xếp hạng">
        <BreakdownDemo />
      </Section>

      <Section title="Bảng đang tải">
        <LoadingTableDemo />
      </Section>

      <Section title="Hộp thoại và thông báo">
        <div className="flex flex-wrap gap-2">
          <ConfirmDemo />
          <ToastDemo />
        </div>
      </Section>
    </main>
  );
}
