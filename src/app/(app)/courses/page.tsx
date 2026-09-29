import { PageHeader } from "@/components/app-shell/page-header";
import { getCurrentUser } from "@/features/auth/queries";
import { CertTypeSection } from "@/features/courses/components/cert-type-section";
import { CoursesTable } from "@/features/courses/components/courses-table";
import { ProviderSection } from "@/features/courses/components/provider-section";
import { listCertTypes, listCourses, listProviders } from "@/features/courses/queries";

export default async function CoursesPage() {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";
  const [certTypes, providers, courses] = await Promise.all([listCertTypes(), listProviders(), listCourses()]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Khóa học" description="Danh mục chứng chỉ, provider và thời hạn." />
      {isAdmin && (
        <>
          <CertTypeSection certTypes={certTypes} />
          <ProviderSection providers={providers} />
        </>
      )}
      <section className="flex flex-col gap-3">
        {isAdmin && <h2 className="text-section-title">Khóa học</h2>}
        <CoursesTable courses={courses} certTypes={certTypes} providers={providers} canManage={isAdmin} />
      </section>
    </div>
  );
}
