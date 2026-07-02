export interface StitchMenuGridProps {
  className?: string;
}

interface MenuItem {
  name: string;
  price: string;
  description: string;
  imageUrl: string;
}

const mockData = {
  sectionLabel: 'Tuyen Chon',
  sectionTitle: 'Thuc Uong Dac Sac',
  items: [
    {
      name: 'Signature Latte',
      price: '55k',
      description: 'Espresso muot ma voi bot sua min duoc pha trong ly chrome thiet ke.',
      imageUrl:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDcgV_lZwApFQ43MSLEA7cx3ukIYUfSX6jrd5uiPbHDFU9AY3OT6ztslrQTbiWyywmWnAb6jpxQGAMBkb1VffIt4lRAdqjeBxzx9h_1YJZw62DCmesjwZldJSL6XFer9Nie4JvV8PPNOm9-V8yYKpV4qPMoPh_7c0wMrUDLHnlCB6-UN7_jAtLxuAXLaUn1nrbOLNsx6wOF47QyhT6dgVYEEK-THMlTtKBsNLwNe9ak4TrT6NIvKXlBpvex7_AuXnujOn-jbry3R0TS',
    } as MenuItem,
    {
      name: 'Crystal Cold Brew',
      price: '65k',
      description: 'Chiet xuat cham 12 tieng, phuc vu voi mot vien da sach nguyen khoi.',
      imageUrl:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuBkZO63JZDf6B4rws8Ioky6LXoFgOk3G26OiWm3minMZdFRwLVmU2bD2T7-7mNFWlRvZXUEUypgIFkgwzF_0NCoq8PL1_R9F4rOYnZQAwKhrthJBmRGbbaSkHiVv0wavPox9HU1IGkbJKnZs25bD3_fDHH5NfzYlNQEN6AfnqYzLbypwTZoKHBwlDGwsnTfcIdmbBwNYoYALhyksoRaeq9KmHdJdBV-aNUqyTC4wUCrNt2707BbO7NuPCH6mYZMHEyU1SRv5arvxMmI',
    } as MenuItem,
    {
      name: 'Aura Specialty',
      price: '75k',
      description: 'Huong thuc vat phoi tron voi hat ca phe cao cap tu vung cao.',
      imageUrl:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuAXfceyHmDRfsZb7BLxCZLRmUFSCb6OhXFW_Vt9d0e-nJTZdyGuWG6eIDAHy3u5Qm4lfNR-5agxKq10sAwzO2RvpR26HdQyMstO_u4AIEwHkLEI4Y2FwLsVP5-dC1coxTcbvXrbjG2Zul_CcGGlTvWn2k96uvzKJD-cwN45TVU9LPhlgRZL3HDjZWIFeiAqywCv87GwNoxY3qkrfHSyk80q_94YgEgF3wvmn1bRAPq_sNxkpzNtWUS82X28jnuLk4XUDdqZzBTwCWFk',
    } as MenuItem,
    {
      name: 'Artisanal Pastry',
      price: '45k',
      description: 'Banh ngot dat chuan vang duoc phuc vu tren dia bac.',
      imageUrl:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuB98BtcBwrm5hZ_jI76gtz9snJGHrHSAIO0YsxFdnq-1-lgXIxPs8qkptyVWAOUOwXWJVfo6rq_AeKF75Dx4hgTZ4vAM2QMD-UEzw5NTPMnYQgw-m7rttaOqpVT6miNMfeGS9SOHGnqJBYXIdJ9AYKMuwaMe0RF_hqhQ0yxKMFlDcasExJPXnquEZnvVLpynP8ULyAWY_Q6Ofp6nqxgx_kxEQ1HwErjwCQWt1lrvmCTS8z64HvsQSf287Gguf6L1ylLrOlgX_-w6oEW',
    } as MenuItem,
  ],
};

export default function StitchMenuGrid({ className = '' }: Readonly<StitchMenuGridProps>) {
  return (
    <section className={'py-[120px] px-[24px] max-w-[1280px] mx-auto ' + className}>
      {/* Section header */}
      <div className="text-center mb-20">
        <span className="text-sm tracking-[0.1em] text-[#b8c7e2] uppercase font-['Space_Grotesk',sans-serif] font-semibold mb-4 block">
          {mockData.sectionLabel}
        </span>
        <h2 className="font-['EB_Garamond',serif] text-[clamp(2.5rem,6vw,3rem)] text-[#e4e2e4] leading-[1.2] tracking-[-0.01em] font-medium">
          {mockData.sectionTitle}
        </h2>
        <div className="w-24 h-px bg-[#b8c7e2] mx-auto mt-6" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {mockData.items.map((item) => (
          <div
            key={item.name}
            className="group relative bg-[#1b1b1d] overflow-hidden border border-[#44474d]/20"
          >
            {/* Image */}
            <div className="aspect-square overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
              />
            </div>
            {/* Content */}
            <div className="p-6">
              <div className="flex justify-between items-end mb-2">
                <h3 className="font-['EB_Garamond',serif] text-[clamp(1.5rem,3vw,2rem)] text-[#e4e2e4] leading-[1.3] font-medium">
                  {item.name}
                </h3>
                <span className="text-sm tracking-[0.1em] text-[#b8c7e2] font-['Space_Grotesk',sans-serif] font-semibold">
                  {item.price}
                </span>
              </div>
              <p className="text-[#c5c6cd] text-base leading-[1.6] mb-4 opacity-70 font-['Space_Grotesk',sans-serif]">
                {item.description}
              </p>
              {/* Brew meter */}
              <div className="relative h-[2px] bg-[#b8c7e2]/10">
                <div
                  className="absolute left-0 top-0 h-full w-[60%] bg-[#b8c7e2]"
                  style={{ boxShadow: '0 0 10px #b8c7e2' }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
