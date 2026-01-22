import { AuthorView } from "@/features/authors";

interface AuthorPageProps {
  params: Promise<{ authorId: string }>;
}

export default async function AuthorPage({ params }: AuthorPageProps) {
  const { authorId } = await params;
  return <AuthorView authorId={authorId} />;
}
