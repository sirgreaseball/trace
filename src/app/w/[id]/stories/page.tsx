import { redirect } from "next/navigation";

// Stories live on the Trace page now; keep old links and filters working.
export default async function StoriesPage(props: PageProps<"/w/[id]/stories">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  redirect(typeof sp.state === "string" ? `/w/${id}/trace?state=${encodeURIComponent(sp.state)}` : `/w/${id}/trace`);
}
