import { PageHeader } from "@/components/app-shell/page-header";
import { ExportLinks } from "@/features/export/components/export-links";
import { CatalogueTabs } from "./catalogue-tabs";
import { getCurrentUser } from "@/features/auth/queries";
import { CertificatesTable } from "@/features/certificates/components/certificates-table";
import { listCertificates } from "@/features/certificates/queries";
import { CertTypeSection } from "@/features/courses/components/cert-type-section";
import { CoursesTable } from "@/features/courses/components/courses-table";
import { ProviderSection } from "@/features/courses/components/provider-section";
import { listCertTypes, listCourses, listProviders } from "@/features/courses/queries";

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string | string[] }>;
}) {
  const { search } = await searchParams;
  // Data Quality links open the Certificates tab already searched (?search=<name>); the key remounts the table when it changes.
  const initialSearch = (Array.isArray(search) ? search[0] : search) ?? "";
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";
  const [certTypes, providers, courses, certificates] = await Promise.all([
    listCertTypes(),
    listProviders(),
    listCourses(),
    listCertificates(),
  ]);
  const preparedBy: Record<string, string[]> = {};
  for (const course of courses) {
    if (course.preparesForId) (preparedBy[course.preparesForId] ??= []).push(course.name);
  }
  const coursesNotGrantingYet = courses
    .filter((c) => c.grantsCertificateName === null)
    .map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Catalogue"
        description="Certificates members can hold and the courses that prepare for or grant them."
        actions={
          isAdmin ? (
            <div className="flex flex-col gap-1 sm:items-end">
              <div className="flex flex-wrap gap-2">
                <ExportLinks endpoint="/api/export/catalogue" />
              </div>
              <p className="text-caption text-muted-foreground">CSV has certificates only. Excel also has a Courses sheet.</p>
            </div>
          ) : undefined
        }
      />
      <CatalogueTabs
        pendingCertificates={isAdmin ? certificates.filter((c) => c.catalogueStatus === "pending").length : 0}
        pendingCourses={isAdmin ? courses.filter((c) => c.catalogueStatus === "pending").length : 0}
        certificates={
          <CertificatesTable
            key={initialSearch}
            initialSearch={initialSearch}
            certificates={certificates}
            certTypes={certTypes}
            providers={providers}
            courses={coursesNotGrantingYet}
            hasCourses={courses.length > 0}
            preparedBy={preparedBy}
            canManage={isAdmin}
          />
        }
        courses={<CoursesTable key={initialSearch} initialSearch={initialSearch} courses={courses} providers={providers} certTypes={certTypes} canManage={isAdmin} />}
      />
      {isAdmin && (
        <>
          <CertTypeSection certTypes={certTypes} />
          <ProviderSection providers={providers} />
        </>
      )}
    </div>
  );
}
