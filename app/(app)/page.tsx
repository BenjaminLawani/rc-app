"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CountView } from "@/components/CountView";
import { todayISO } from "@/lib/local/queries";

function CountPageInner() {
  const params = useSearchParams();
  const date = params.get("d") || todayISO();
  return <CountView date={date} />;
}

export default function CountPage() {
  return (
    <Suspense fallback={null}>
      <CountPageInner />
    </Suspense>
  );
}
