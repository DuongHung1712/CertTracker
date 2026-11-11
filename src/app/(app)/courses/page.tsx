import { PageHeader } from "@/components/app-shell/page-header";
import { getCurrentUser } from "@/features/auth/queries";
import { listCertificates } from "@/features/certificates/queries";
import { CertTypeSection } from "@/features/courses/components/cert-type-section";
import { CoursesTable } from "@/features/courses/components/courses-table";
import { ProviderSection } from "@/features/courses/components/provider-section";
import { listCertTypes, listCourses, listProviders } from "@/features/courses/queries";

export default async function CoursesPage() {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";
  const [certTypes, providers, courses, certificates] = await Promise.all([
    listCertTypes(),
    listProviders(),
    listCourses(),
    listCertificates(),
  ]);
  const examOptions = certificates.filter((c) => c.kind === "exam").map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Courses" description="Certificate types, providers and validity periods." />
      {isAdmin && (
        <>
          <CertTypeSection certTypes={certTypes} />
          <ProviderSection providers={providers} />
        </>
      )}
      <section className="flex flex-col gap-3">
        <CoursesTable courses={courses} certificates={examOptions} providers={providers} canManage={isAdmin} />
      </section>
    </div>
  );
}
