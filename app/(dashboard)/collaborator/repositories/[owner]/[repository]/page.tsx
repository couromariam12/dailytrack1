import RepositoryDetail from "@/components/repository-detail";

export default async function RepositoryPage({ params }: { params: Promise<{ owner: string; repository: string }> }) {
  const { owner, repository } = await params;
  return <RepositoryDetail owner={decodeURIComponent(owner)} repository={decodeURIComponent(repository)} />;
}

