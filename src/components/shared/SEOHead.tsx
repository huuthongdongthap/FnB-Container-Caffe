import { useEffect, useRef } from 'react';

interface SEOHeadProps {
  title: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  noindex?: boolean;
}

export function SEOHead({
  title,
  description,
  ogTitle,
  ogDescription,
  ogImage,
  ogType,
  noindex,
}: SEOHeadProps) {
  const descriptionRef = useRef<HTMLMetaElement | null>(null);
  const robotsRef = useRef<HTMLMetaElement | null>(null);
  const ogTitleRef = useRef<HTMLMetaElement | null>(null);
  const ogDescRef = useRef<HTMLMetaElement | null>(null);
  const ogImageRef = useRef<HTMLMetaElement | null>(null);
  const ogTypeRef = useRef<HTMLMetaElement | null>(null);

  useEffect(() => {
    document.title = title;

    // Meta description
    if (description) {
      if (!descriptionRef.current) {
        const meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
        descriptionRef.current = meta;
      }
      descriptionRef.current.content = description;
    }

    // Robots
    if (noindex) {
      if (!robotsRef.current) {
        const meta = document.createElement('meta');
        meta.name = 'robots';
        document.head.appendChild(meta);
        robotsRef.current = meta;
      }
      robotsRef.current.content = 'noindex, nofollow';
    }

    // OG tags
    if (ogTitle) {
      if (!ogTitleRef.current) {
        const meta = document.createElement('meta');
        meta.setAttribute('property', 'og:title');
        document.head.appendChild(meta);
        ogTitleRef.current = meta;
      }
      ogTitleRef.current.content = ogTitle;
    }

    if (ogDescription) {
      if (!ogDescRef.current) {
        const meta = document.createElement('meta');
        meta.setAttribute('property', 'og:description');
        document.head.appendChild(meta);
        ogDescRef.current = meta;
      }
      ogDescRef.current.content = ogDescription;
    }

    if (ogImage) {
      if (!ogImageRef.current) {
        const meta = document.createElement('meta');
        meta.setAttribute('property', 'og:image');
        document.head.appendChild(meta);
        ogImageRef.current = meta;
      }
      ogImageRef.current.content = ogImage;
    }

    if (ogType) {
      if (!ogTypeRef.current) {
        const meta = document.createElement('meta');
        meta.setAttribute('property', 'og:type');
        document.head.appendChild(meta);
        ogTypeRef.current = meta;
      }
      ogTypeRef.current.content = ogType;
    }

    return () => {
      // Clean up meta tags on unmount
      if (descriptionRef.current) {
        descriptionRef.current.remove();
        descriptionRef.current = null;
      }
      if (robotsRef.current) {
        robotsRef.current.remove();
        robotsRef.current = null;
      }
      if (ogTitleRef.current) {
        ogTitleRef.current.remove();
        ogTitleRef.current = null;
      }
      if (ogDescRef.current) {
        ogDescRef.current.remove();
        ogDescRef.current = null;
      }
      if (ogImageRef.current) {
        ogImageRef.current.remove();
        ogImageRef.current = null;
      }
      if (ogTypeRef.current) {
        ogTypeRef.current.remove();
        ogTypeRef.current = null;
      }
    };
  }, [title, description, ogTitle, ogDescription, ogImage, ogType, noindex]);

  return null;
}
