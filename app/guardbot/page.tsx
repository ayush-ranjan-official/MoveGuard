'use client';

import { AgentDashboard } from '@/components/guardbot/AgentDashboard';
import { Navbar } from '@/components/shared/Navbar';

export default function GuardBotPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <AgentDashboard />
      </div>
    </main>
  );
}
