'use client';

import { useState, useEffect } from 'react';
import { Search, Loader2, Shield, TrendingUp, AlertTriangle, ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { GuardBotStats, AgentStatus } from '@/lib/guardbot/types';
import { getRegisteredProtocols, type RegisteredProtocol } from '@/lib/protocol-registry';

interface MonitoringPanelProps {
  stats: GuardBotStats;
  status: AgentStatus;
  onMonitor: (address: string, name?: string) => Promise<unknown>;
}

export function MonitoringPanel({ stats, status, onMonitor }: MonitoringPanelProps) {
  const [protocolAddress, setProtocolAddress] = useState('');
  const [protocolName, setProtocolName] = useState('');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [registeredProtocols, setRegisteredProtocols] = useState<RegisteredProtocol[]>([]);
  const [selectedProtocol, setSelectedProtocol] = useState<string>('');

  // Load registered protocols from shared registry
  useEffect(() => {
    const protocols = getRegisteredProtocols();
    setRegisteredProtocols(protocols);
    // Auto-select first protocol if available
    if (protocols.length > 0) {
      setSelectedProtocol(protocols[0].contractAddress);
      setProtocolAddress(protocols[0].contractAddress);
      setProtocolName(protocols[0].name);
    }
  }, []);

  // Handle protocol selection from dropdown
  const handleProtocolSelect = (address: string) => {
    setSelectedProtocol(address);
    if (address === 'custom') {
      setProtocolAddress('');
      setProtocolName('');
    } else {
      const protocol = registeredProtocols.find(p => p.contractAddress === address);
      if (protocol) {
        setProtocolAddress(protocol.contractAddress);
        setProtocolName(protocol.name);
      }
    }
  };

  const handleMonitor = async () => {
    if (!protocolAddress) return;

    setIsMonitoring(true);
    try {
      await onMonitor(protocolAddress, protocolName || undefined);
    } finally {
      setIsMonitoring(false);
    }
  };

  const isActive = ['monitoring', 'analyzing', 'reporting'].includes(status);

  return (
    <Card className="p-4 bg-card border-border">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-400" />
            Protocol Monitoring
          </h3>
          <p className="text-xs text-muted-foreground">
            Scan DeFi protocols for vulnerabilities
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard
          label="Protocols Scanned"
          value={stats.protocolsMonitored}
          icon={Search}
          color="blue"
        />
        <StatCard
          label="Threats Detected"
          value={stats.threatsDetected}
          icon={AlertTriangle}
          color={stats.threatsDetected > 0 ? 'red' : 'gray'}
        />
        <StatCard
          label="Reports Submitted"
          value={stats.reportsSubmitted}
          icon={Shield}
          color="orange"
        />
        <StatCard
          label="Pending Earnings"
          value={`${stats.totalEarningsMove} MOVE`}
          icon={TrendingUp}
          color="green"
        />
      </div>

      {/* Protocol Scan Form */}
      <div className="space-y-3 p-3 rounded-lg bg-background/50 border border-border">
        <p className="text-xs font-medium text-muted-foreground">Select Protocol to Scan</p>

        {/* Protocol Dropdown */}
        <div className="relative">
          <select
            value={selectedProtocol}
            onChange={(e) => handleProtocolSelect(e.target.value)}
            className="w-full h-10 px-3 pr-10 rounded-md border border-border bg-background text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {registeredProtocols.map((protocol) => (
              <option key={protocol.contractAddress} value={protocol.contractAddress}>
                {protocol.name} ({protocol.contractAddress.slice(0, 8)}...{protocol.contractAddress.slice(-4)})
              </option>
            ))}
            <option value="custom">+ Enter custom address</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>

        {/* Show input fields for custom address */}
        {selectedProtocol === 'custom' && (
          <>
            <Input
              placeholder="Protocol contract address (0x...)"
              value={protocolAddress}
              onChange={(e) => setProtocolAddress(e.target.value)}
              className="font-mono text-sm"
            />
            <Input
              placeholder="Protocol name (optional)"
              value={protocolName}
              onChange={(e) => setProtocolName(e.target.value)}
              className="text-sm"
            />
          </>
        )}

        {/* Show selected protocol info */}
        {selectedProtocol !== 'custom' && selectedProtocol && (
          <div className="p-2 rounded bg-purple-500/10 border border-purple-500/20">
            <p className="text-xs text-muted-foreground">Contract Address:</p>
            <p className="font-mono text-xs text-purple-300 break-all">{protocolAddress}</p>
          </div>
        )}

        <Button
          onClick={handleMonitor}
          disabled={!protocolAddress || isMonitoring || isActive}
          className="w-full bg-purple-600 hover:bg-purple-700 gap-2"
        >
          {isMonitoring || isActive ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {status === 'analyzing' ? 'Analyzing...' : 'Scanning...'}
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Scan Protocol
            </>
          )}
        </Button>
      </div>

      {/* Payment Info */}
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>Cost per scan: 0.001 MOVE</span>
        <span className="flex items-center gap-1">
          <span className="text-purple-400">x402</span> micropayment
        </span>
      </div>
    </Card>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: typeof Search;
  color: 'blue' | 'red' | 'green' | 'orange' | 'gray';
}) {
  const colors = {
    blue: 'text-blue-400 bg-blue-500/10',
    red: 'text-red-400 bg-red-500/10',
    green: 'text-green-400 bg-green-500/10',
    orange: 'text-orange-400 bg-orange-500/10',
    gray: 'text-gray-400 bg-gray-500/10',
  };

  return (
    <div className="p-3 rounded-lg bg-background/50 border border-border">
      <div className="flex items-center gap-2 mb-1">
        <div className={cn('p-1 rounded', colors[color])}>
          <Icon className="w-3 h-3" />
        </div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={cn('text-lg font-bold', colors[color].split(' ')[0])}>
        {value}
      </p>
    </div>
  );
}
