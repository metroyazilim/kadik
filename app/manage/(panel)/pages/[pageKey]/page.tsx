import { redirect } from "next/navigation";

export default async function PageEditorPage({
  params,
}: {
  params: Promise<{ pageKey: string }>;
}) {
  const { pageKey } = await params;
  if (pageKey === "home") redirect("/manage/home");
  redirect(`/manage/pages/copy/${pageKey}`);
}
