import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CoursePlayer from "@/components/course/CoursePlayer";
import { getCourse } from "@/lib/course-store";

export const dynamic = "force-dynamic";

/** 分享页：按链接公开播放（id 为 CSPRNG，不可枚举，链接即访问凭证）。 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const doc = await getCourse(id).catch(() => null);
  return { title: doc ? `${doc.title} — 言课` : "课件 — 言课" };
}

export default async function CourseSharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^crs_[A-Za-z0-9_-]+$/.test(id)) notFound();
  const doc = await getCourse(id).catch(() => null);
  if (!doc) notFound();
  return <CoursePlayer slides={doc.slides} />;
}
