export interface StitchFooterProps {
  className?: string;
}

interface FooterLink {
  label: string;
  href: string;
}

const mockData = {
  logoSrc:
    'https://lh3.googleusercontent.com/aida/AP1WRLve679C9FepzxtdoIpYGvevRbxekcoH6qEPU8Lx9FOk8H2s25hvHtdS_X2fUjHlgj0_4Fv7c26VDLs17UV0L9KogiyguD74EYag3u6bWwZ4r2lVETyCcAHKPC-E6R8dBVp7nn5JJPsvez53nlGbrpReDBcpo3rGEUzUFHXvWGUeqUvX4gtoYeI6SCLW74RuSvNNiH7o8wYZ9c19IgpI98k41U0Grn2AuFKrFQQqWbxIj_mcma7UbQLrHuvI',
  tagline: 'INDUSTRIAL LUXURY BREWING.',
  links: [
    { label: 'Chinh Sach Bao Mat', href: '#' },
    { label: 'Dieu Khoan Dich Vu', href: '#' },
    { label: 'Bao Chi', href: '#' },
    { label: 'Tuyen Dung', href: '#' },
  ],
  copyright: '2024 AURA CAFE SA DEC. Bao Luu Moi Quyen.',
};

export default function StitchFooter({ className = '' }: Readonly<StitchFooterProps>) {
  return (
    <footer
      className={
        'bg-[#0e0e10] border-t border-[#44474d]/20 w-full py-[120px] ' + className
      }
    >
      <div className="flex flex-col md:flex-row justify-between items-center px-[24px] max-w-[1280px] mx-auto gap-8">
        {/* Logo + tagline */}
        <div className="text-center md:text-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mockData.logoSrc}
            alt="Aura Cafe Logo"
            className="h-12 w-auto mb-4 mx-auto md:mx-0 opacity-90"
          />
          <p className="text-sm tracking-[0.1em] text-[#b8c7e2] max-w-xs font-['Space_Grotesk',sans-serif] font-semibold">
            {mockData.tagline}
          </p>
        </div>

        {/* Links */}
        <div className="flex flex-wrap justify-center gap-8 md:gap-12">
          {mockData.links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm tracking-[0.1em] text-[#afb6bd] hover:text-[#b8c7e2] transition-colors ease-out duration-200 font-['Space_Grotesk',sans-serif] font-semibold"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Copyright */}
        <p className="text-sm tracking-[0.1em] text-[#b9c8de] text-center md:text-right font-['Space_Grotesk',sans-serif] font-semibold">
          &copy; {mockData.copyright}
        </p>
      </div>
    </footer>
  );
}
