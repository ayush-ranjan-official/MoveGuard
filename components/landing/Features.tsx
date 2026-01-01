'use client';

import { motion } from 'framer-motion';
import {
  Shield,
  Coins,
  Bug,
  Brain,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const features = [
  {
    icon: Brain,
    title: 'AI Threat Detection',
    description:
      'Advanced AI analyzes transaction patterns in real-time, detecting flash loans, oracle manipulation, and other exploit patterns before damage occurs.',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
  {
    icon: Shield,
    title: 'Instant Auto-Pause',
    description:
      'When threats are detected, vulnerable contracts are automatically paused in under 3 seconds, preventing exploit completion.',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
  },
  {
    icon: Coins,
    title: 'Pay-Per-Block',
    description:
      'Revolutionary pricing model - only pay $0.001 per block for protection. No yearly contracts, no hidden fees. Stop anytime.',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
  },
  {
    icon: Bug,
    title: 'Instant Bounties',
    description:
      'White-hat researchers submit vulnerabilities and receive payouts instantly via x402 micropayments. No 90-day wait times.',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
];

export function Features() {
  return (
    <section className="py-24 bg-background relative">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/5 via-transparent to-transparent" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Complete DeFi Security Suite
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Everything you need to protect your protocols from exploits, all
            powered by AI and paid for with micropayments.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-24">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                className={cn(
                  'p-6 h-full border transition-all duration-300 hover:scale-[1.02]',
                  feature.bgColor,
                  feature.borderColor
                )}
              >
                <div
                  className={cn(
                    'inline-flex p-3 rounded-lg mb-4',
                    feature.bgColor
                  )}
                >
                  <feature.icon className={cn('w-6 h-6', feature.color)} />
                </div>
                <h3 className={cn('text-xl font-semibold mb-2', feature.color)}>
                  {feature.title}
                </h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* How It Works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-24"
        >
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Connect & Register',
                description:
                  'Sign in with email or social using Privy. Register your protocol for protection in one click.',
              },
              {
                step: '02',
                title: 'Start Payment Stream',
                description:
                  'Deposit MOVE to activate protection. Our AI begins monitoring your protocol immediately.',
              },
              {
                step: '03',
                title: 'Stay Protected',
                description:
                  'AI continuously analyzes transactions. Threats trigger instant pause, keeping funds safe.',
              },
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-500/10 border border-purple-500/30 mb-4">
                  <span className="text-2xl font-bold text-purple-400">
                    {item.step}
                  </span>
                </div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

      </div>
    </section>
  );
}
