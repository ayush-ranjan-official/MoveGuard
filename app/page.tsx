import { Hero } from '@/components/landing/Hero';
import { Features } from '@/components/landing/Features';
import { Navbar } from '@/components/shared/Navbar';
import { Shield, Github, Twitter } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <Features />

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-t from-purple-900/20 to-background">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">
            Ready to Secure Your Protocol?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Join the future of DeFi security. Pay only for what you use, protect
            in real-time, and reward researchers instantly.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
            >
              <Shield className="w-5 h-5" />
              Launch App
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-600/10">
                <Shield className="w-5 h-5 text-purple-500" />
              </div>
              <span className="font-bold">
                Move<span className="text-purple-500">Guard</span>
              </span>
            </div>

            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/dashboard" className="hover:text-foreground transition-colors">
                Dashboard
              </Link>
              <Link href="/researcher" className="hover:text-foreground transition-colors">
                Researchers
              </Link>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                <Github className="w-5 h-5" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                <Twitter className="w-5 h-5" />
              </a>
            </div>

            <p className="text-sm text-muted-foreground">
              Securing DeFi on Movement
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
