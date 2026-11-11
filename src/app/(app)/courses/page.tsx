import { PageHeader } from "@/components/app-shell/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/features/auth/queries";
import { CertificatesTable } from "@/features/certificates/components/certificates-table";
import { listCertificates } from "@/features/certificates/queries";
import { CertTypeSection } from "@/features/courses/components/cert-type-section";
import { CoursesTable } from "@/features/courses/components/courses-table";
import { ProviderSection } from "@/features/courses/components/provider-section";
import { listCertTypes, listCourses, listProviders } from "@/features/courses/queries";

export default async function CataloguePage() {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";
  const [certTypes, providers, courses, certificates] = await Promise.all([
    listCertTypes(),
    listProviders(),
    listCourses(),
    listCertificates(),
  ]);
  const examOptions = certificates.filter((c) => c.kind === "exam").map((c) => ({ id: c.id, name: c.name }));
  const courseNotGrantingYet = courses
    .filter((c) => c.grantsCertificateName === null)
    .map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Catalogue" description="Certificates members can hold and the courses that prepare for or grant them." />
      <Tabs defaultValue="certificates">
        <TabsList>
          <TabsTrigger value="certificates">Certificates</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
        </TabsList>
        <TabsContent value="certificates">
          <CertificatesTable
            certificates={certificates}
            certTypes={certTypes}
            providers={providers}
            courses={courseNotGrantingYet}
            canManage={isAdmin}
          />
        </TabsContent>
        <TabsContent value="courses">
          <CoursesTable courses={courses} certificates={examOptions} providers={providers} canManage={isAdmin} />
        </TabsContent>
      </Tabs>
      {isAdmin && (
        <>
          <CertTypeSection certTypes={certTypes} />
          <ProviderSection providers={providers} />
        </>
      )}
    </div>
  );
}
