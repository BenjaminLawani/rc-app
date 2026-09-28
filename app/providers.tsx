"use client";

import { AuthProvider } from "@/lib/client/auth";
import { SyncProvider } from "@/lib/client/sync";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SyncProvider>
        <ServiceWorkerRegister />
        {children}
      </SyncProvider>
    </AuthProvider>
  );
}
