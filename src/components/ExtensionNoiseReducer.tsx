'use client';
import { useEffect } from 'react';

/**
 * Security Shield: Suppress noise and interference from browser extensions 
 * (like MetaMask) that the app does not use.
 */
export function ExtensionNoiseReducer() {
  useEffect(() => {
    // 1. Explicitly nullify Web3 interfaces to prevent wallet popups
    try {
      const win = window as unknown as { ethereum?: unknown; web3?: unknown };
      if (!win.ethereum) {
        Object.defineProperty(window, 'ethereum', {
          get() { return undefined; },
          set() { /* Block injection */ },
          configurable: false
        });
      }
      if (!win.web3) {
        Object.defineProperty(window, 'web3', {
          get() { return undefined; },
          set() { /* Block injection */ },
          configurable: false
        });
      }
    } catch {
      const win = window as unknown as { ethereum?: unknown; web3?: unknown };
      win.ethereum = undefined;
      win.web3 = undefined;
    }

    // 2. Suppress console errors from extensions
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const msg = args[0]?.toString() || '';
      if (
        msg.includes('chrome-extension://') || 
        msg.includes('MetaMask') ||
        msg.includes('ethereum') ||
        msg.includes('web3') ||
        msg.includes('data-qb-installed')
      ) return;
      originalConsoleError.apply(console, args);
    };

    // 3. Suppress unhandled rejections from extensions
    const handleRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.stack || event.reason?.message || '';
      if (
        msg.includes('chrome-extension://') || 
        msg.includes('MetaMask') ||
        msg.includes('ethereum')
      ) {
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', handleRejection);
    return () => window.removeEventListener('unhandledrejection', handleRejection);
  }, []);

  return null;
}
