import { Suspense } from "react";
import { ArkaAddJob } from "@/components/arka-add-job";

export const metadata = { title: "Add a Job" };

export default function AddJobPage() {
  return <Suspense><ArkaAddJob /></Suspense>;
}
