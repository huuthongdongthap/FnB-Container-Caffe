import brandConfig from "../../config/brand.json";

export interface Zone {
  id: string;
  name: string;
  description: string;
}

export interface BrandConfig {
  brand: {
    name: string;
    nameShort: string;
    tagline: string;
    description: string;
    address: string;
    phone: string;
    email: string;
    domain: string;
    workerUrl: string;
    pagesUrl: string;
  };
  seo: {
    title: string;
    description: string;
    ogImage: string;
    locale: string;
  };
  theme: {
    colors: {
      background: string;
      foreground: string;
      primary: string;
      secondary: string;
      tertiary: string;
    };
    fonts: {
      display: string;
      body: string;
      mono: string;
    };
  };
  contact: {
    zalo: string;
    facebook: string;
    instagram: string;
    tiktok: string;
    googleMaps: string;
  };
  zones: Zone[];
  footer: {
    copyright: string;
    showSocialLinks: boolean;
  };
}

/** Load brand config, merging optional runtime overrides. */
export function loadBrandConfig(overrides?: Partial<BrandConfig>): BrandConfig {
  return { ...brandConfig, ...overrides } as BrandConfig;
}

export { brandConfig };
