import { redirect } from "next/navigation";

function missionHref(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.append(key, value);
    else if (Array.isArray(value)) for (const item of value) query.append(key, item);
  }
  const text = query.toString();
  return text ? `/mission?${text}` : "/mission";
}

export default async function NavigatorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirect(missionHref(await searchParams));
}
