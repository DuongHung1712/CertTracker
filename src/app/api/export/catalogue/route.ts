import { getCurrentUser } from "@/features/auth/queries";
import { listCertificates } from "@/features/certificates/queries";
import { catalogueToCsv, catalogueToXlsx } from "@/features/export/catalogue-export";
import { listCourses } from "@/features/courses/queries";
import { todayVn } from "@/lib/dates";

// Node.js runtime (default): the xlsx writer is not edge-safe.
export const maxDuration = 60;

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(request: Request) {
  const format = new URL(request.url).searchParams.get("format");
  if (format !== "csv" && format !== "xlsx") return new Response("Invalid format.", { status: 400 });
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in.", { status: 401 });
  // The catalogue is readable by everyone, but exporting it is an admin tool; the reads below still go through RLS.
  if (user.role !== "admin") return new Response("Only admins can export the catalogue.", { status: 403 });

  let body: string | Uint8Array<ArrayBuffer>;
  try {
    const [certificates, courses] = await Promise.all([listCertificates(), listCourses()]);
    body = format === "csv" ? catalogueToCsv(certificates, courses) : catalogueToXlsx(certificates, courses);
  } catch (error) {
    console.error("export: could not load the catalogue", error);
    return new Response("Could not export the data. Try again.", { status: 500 });
  }
  return new Response(body, {
    headers: {
      "Content-Disposition": `attachment; filename="certtracker-catalogue-${todayVn()}.${format}"`,
      "Cache-Control": "no-store",
      "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : XLSX_TYPE,
    },
  });
}
