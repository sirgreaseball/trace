import { Splash } from "@/components/splash/splash";
import { currentUser } from "@/lib/supabase/server";

export default async function Home() {
  const user = await currentUser();
  return <Splash signedIn={!!user} />;
}
