'use client';

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

export interface StitchHeaderProps {
  logoSrc?: string;
}

const navLinks = [
  { label: 'Thuc Don', to: '/menu' },
  { label: 'Khong Gian', to: '/about' },
  { label: 'Dat Ban', to: '/table-reservation' },
  { label: 'Khuyen Mai', to: '/promotions' },
  { label: 'Danh Gia', to: '/reviews' },
];

const defaultLogoSrc =
  'https://lh3.googleusercontent.com/aida/AP1WRLve679C9FepzxtdoIpYGvevRbxekcoH6qEPU8Lx9FOk8H2s25hvHtdS_X2fUjHlgj0_4Fv7c26VDLs17UV0L9KogiyguD74EYag3u6bWwZ4r2lVETyCcAHKPC-E6R8dBVp7nn5JJPsvez53nlGbrpReDBcpo3rGEUzUFHXvWGUeqUvX4gtoYeI6SCLW74RuSvNNiH7o8wYZ9c19IgpI98k41U0Grn2AuFKrFQQqWbxIj_mcma7UbQLrHuvI';

export default function StitchHeader({ logoSrc = defaultLogoSrc }: Readonly<StitchHeaderProps>) {
  const [scrolled, setScrolled] = useState(false);
  const { user, token } = useAuthStore();
  const isLoggedIn = !!token && !!user;

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 50);
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={
        'fixed top-0 w-full z-50 backdrop-blur-xl border-b border-[#44474d]/30 transition-all duration-500 ease-in-out ' +
        (scrolled ? 'bg-[#0A1A2E]/90 py-4' : 'bg-[#0A1A2E]/60 py-6')
      }
    >
      <div className="flex justify-between items-center px-[24px] max-w-[1280px] mx-auto">
        {/* Logo */}
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt="Aura Cafe Logo"
            className="h-10 w-auto opacity-90"
          />
          <Link to="/" className="hidden md:block">
            <span className="text-[clamp(2.5rem,8vw,3rem)] tracking-widest text-[#b8c7e2] uppercase font-['EB_Garamond',serif] leading-[1.2] font-medium">
              AURA CAFE
            </span>
          </Link>
        </div>

        {/* Nav Links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-[#c5c6cd] hover:text-[#b8c7e2] transition-colors duration-300 text-sm tracking-[0.1em] font-semibold font-['Space_Grotesk',sans-serif]"
            >
              {link.label}
            </Link>
          ))}
          {isLoggedIn && (
            <Link
              to="/account"
              className="text-[#c5c6cd] hover:text-[#b8c7e2] transition-colors duration-300 text-sm tracking-[0.1em] font-semibold font-['Space_Grotesk',sans-serif] flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {user.name}
            </Link>
          )}
        </div>

        {/* CTA */}
        <Link
          to="/table-reservation"
          className="bg-gradient-to-br from-[#e0e0e0] via-[#a0a0a0] to-[#c0c0c0] text-black text-sm tracking-[0.1em] font-semibold px-6 py-3 font-['Space_Grotesk',sans-serif] hover:opacity-80 transition-opacity inline-block"
        >
          Dat Ban Ngay
        </Link>
      </div>
    </nav>
  );
}
