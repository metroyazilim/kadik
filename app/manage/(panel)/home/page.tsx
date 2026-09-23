import { redirect } from "next/navigation";

/** The home page is edited from "Sayfalar" like every other page; old links land there. */
export default function LegacyHomeEditor() {
  redirect("/manage/pages/home");
}
