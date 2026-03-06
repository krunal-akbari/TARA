import { redirect } from "next/navigation";

type RoutingPageProps = {
  params: Promise<{ id: string }>;
};

export default async function RoutingPage({ params }: RoutingPageProps) {
  const { id } = await params;
  redirect(`/jobs/${id}`);
}
